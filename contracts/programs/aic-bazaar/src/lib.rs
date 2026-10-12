use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX");

pub const MIN_BUDGET: u64 = 1_000_000;
pub const MAX_BUDGET: u64 = 1_000_000_000;
pub const TEMPLATE_VERSION: u8 = 1;
pub const TERMINAL_MILESTONE: u8 = 3;

#[program]
pub mod aic_bazaar {
    use super::*;

    pub fn create_deal(
        ctx: Context<CreateDeal>,
        deal_id: u64,
        creator: Pubkey,
        arbiter: Pubkey,
        title: String,
        brief: String,
        references_url: String,
        budget_lamports: u64,
        deadlines: [i64; 3],
    ) -> Result<()> {
        validate_text(&title, 64)?;
        validate_text(&brief, 200)?;
        validate_url(&references_url, true)?;
        require!(
            (MIN_BUDGET..=MAX_BUDGET).contains(&budget_lamports),
            BazaarError::InvalidInput
        );

        let client = ctx.accounts.client.key();
        let deal_address = ctx.accounts.deal.key();
        require!(
            client != Pubkey::default()
                && creator != Pubkey::default()
                && arbiter != Pubkey::default()
                && client != creator
                && client != arbiter
                && creator != arbiter
                && creator != deal_address
                && arbiter != deal_address,
            BazaarError::InvalidInput
        );
        let now = Clock::get()?.unix_timestamp;
        require!(
            deadlines[0] > now
                && deadlines[1] > deadlines[0]
                && deadlines[2] > deadlines[1],
            BazaarError::InvalidInput
        );
        let amounts = split_budget(budget_lamports)?;
        let rent_reserve_lamports = Rent::get()?.minimum_balance(8 + Deal::INIT_SPACE);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.client.to_account_info(),
                    to: ctx.accounts.deal.to_account_info(),
                },
            ),
            budget_lamports,
        )?;

        let deal = &mut ctx.accounts.deal;
        deal.deal_id = deal_id;
        deal.client = client;
        deal.creator = creator;
        deal.arbiter = arbiter;
        deal.title = title;
        deal.brief = brief;
        deal.references_url = references_url;
        deal.template_version = TEMPLATE_VERSION;
        deal.budget_lamports = budget_lamports;
        deal.bond_lamports = budget_lamports / 10;
        deal.remaining_budget_lamports = budget_lamports;
        deal.locked_bond_lamports = 0;
        deal.rent_reserve_lamports = rent_reserve_lamports;
        deal.status = DealStatus::AwaitingCreator;
        deal.current_milestone = 0;
        deal.milestones = [
            Milestone::new(amounts[0], deadlines[0]),
            Milestone::new(amounts[1], deadlines[1]),
            Milestone::new(amounts[2], deadlines[2]),
        ];
        deal.dispute_opened_by = Pubkey::default();
        deal.dispute_reason = String::new();
        deal.dispute_opened_at = 0;
        deal.resolution_outcome = ResolutionOutcome::Refund;
        deal.resolution_reason = String::new();
        deal.resolved_at = 0;
        deal.created_at = now;
        deal.bump = ctx.bumps.deal;
        assert_funded(deal)
    }

    pub fn accept_deal(ctx: Context<AcceptDeal>) -> Result<()> {
        let deal = &ctx.accounts.deal;
        require!(
            deal.status == DealStatus::AwaitingCreator,
            BazaarError::InvalidState
        );
        assert_funded(deal)?;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.deal.to_account_info(),
                },
            ),
            deal.bond_lamports,
        )?;
        let deal = &mut ctx.accounts.deal;
        deal.locked_bond_lamports = deal.bond_lamports;
        deal.status = DealStatus::Active;
        assert_funded(deal)
    }

    pub fn submit_milestone(
        ctx: Context<SubmitMilestone>,
        index: u8,
        url: String,
        sha256: [u8; 32],
        expected_revision: u8,
    ) -> Result<()> {
        validate_url(&url, false)?;
        let deal = &mut ctx.accounts.deal;
        require!(deal.status == DealStatus::Active, BazaarError::InvalidState);
        require!(index < 3, BazaarError::InvalidInput);
        require!(index == deal.current_milestone, BazaarError::StaleSubmission);
        let milestone = &mut deal.milestones[usize::from(index)];
        require!(milestone.paid_at == 0, BazaarError::InvalidState);
        require!(milestone.revision < 2, BazaarError::RevisionLimit);
        require!(expected_revision <= 1, BazaarError::InvalidInput);
        require!(
            expected_revision == milestone.revision,
            BazaarError::StaleSubmission
        );
        milestone.url = url;
        milestone.sha256 = sha256;
        milestone.revision = milestone
            .revision
            .checked_add(1)
            .ok_or(BazaarError::ArithmeticOverflow)?;
        milestone.submitted_at = Clock::get()?.unix_timestamp;
        assert_funded(deal)
    }

    pub fn approve_milestone(
        ctx: Context<ApproveMilestone>,
        index: u8,
        expected_revision: u8,
        expected_hash: [u8; 32],
    ) -> Result<()> {
        let deal = &ctx.accounts.deal;
        require!(deal.status == DealStatus::Active, BazaarError::InvalidState);
        require!(index < 3, BazaarError::InvalidInput);
        require!(index == deal.current_milestone, BazaarError::StaleSubmission);
        let milestone = &deal.milestones[usize::from(index)];
        require!(milestone.revision > 0 && milestone.paid_at == 0, BazaarError::InvalidState);
        require!(
            expected_revision == milestone.revision && expected_hash == milestone.sha256,
            BazaarError::StaleSubmission
        );
        assert_funded(deal)?;
        let payment = milestone.amount_lamports;
        let bond_return = if index == 2 { deal.locked_bond_lamports } else { 0 };
        let total = checked_add(payment, bond_return)?;
        transfer_from_escrow(
            &deal.to_account_info(),
            &ctx.accounts.creator.to_account_info(),
            total,
            deal.rent_reserve_lamports,
        )?;
        let deal = &mut ctx.accounts.deal;
        deal.remaining_budget_lamports = checked_sub(deal.remaining_budget_lamports, payment)?;
        deal.milestones[usize::from(index)].paid_at = Clock::get()?.unix_timestamp;
        if index == 2 {
            deal.locked_bond_lamports = 0;
            deal.status = DealStatus::Completed;
            deal.current_milestone = TERMINAL_MILESTONE;
        } else {
            deal.current_milestone = index.checked_add(1).ok_or(BazaarError::ArithmeticOverflow)?;
        }
        assert_funded(deal)
    }

    pub fn open_dispute(ctx: Context<OpenDispute>, reason: String) -> Result<()> {
        validate_text(&reason, 200)?;
        let deal = &mut ctx.accounts.deal;
        let party = ctx.accounts.party.key();
        require!(party == deal.client || party == deal.creator, BazaarError::WrongRole);
        require!(deal.status == DealStatus::Active, BazaarError::InvalidState);
        deal.status = DealStatus::Disputed;
        deal.dispute_opened_by = party;
        deal.dispute_reason = reason;
        deal.dispute_opened_at = Clock::get()?.unix_timestamp;
        assert_funded(deal)
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        outcome: ResolutionOutcome,
        reason: String,
    ) -> Result<()> {
        validate_text(&reason, 200)?;
        let deal = &ctx.accounts.deal;
        require!(deal.status == DealStatus::Disputed, BazaarError::InvalidState);
        require!(deal.current_milestone < 3, BazaarError::InvalidState);
        assert_funded(deal)?;
        let index = usize::from(deal.current_milestone);
        let (client_amount, creator_amount, pay_current) = match outcome {
            ResolutionOutcome::PayCurrent => {
                let milestone = &deal.milestones[index];
                require!(milestone.revision > 0 && milestone.paid_at == 0, BazaarError::InvalidState);
                (
                    checked_sub(deal.remaining_budget_lamports, milestone.amount_lamports)?,
                    checked_add(milestone.amount_lamports, deal.locked_bond_lamports)?,
                    true,
                )
            }
            ResolutionOutcome::Refund => (
                deal.remaining_budget_lamports,
                deal.locked_bond_lamports,
                false,
            ),
            ResolutionOutcome::CreatorBreach => (
                checked_add(deal.remaining_budget_lamports, deal.locked_bond_lamports)?,
                0,
                false,
            ),
        };
        require!(
            checked_add(client_amount, creator_amount)?
                == checked_add(deal.remaining_budget_lamports, deal.locked_bond_lamports)?,
            BazaarError::ArithmeticOverflow
        );
        transfer_from_escrow(
            &deal.to_account_info(),
            &ctx.accounts.client.to_account_info(),
            client_amount,
            deal.rent_reserve_lamports,
        )?;
        transfer_from_escrow(
            &deal.to_account_info(),
            &ctx.accounts.creator.to_account_info(),
            creator_amount,
            deal.rent_reserve_lamports,
        )?;
        let now = Clock::get()?.unix_timestamp;
        let deal = &mut ctx.accounts.deal;
        if pay_current {
            deal.milestones[index].paid_at = now;
        }
        deal.remaining_budget_lamports = 0;
        deal.locked_bond_lamports = 0;
        deal.status = DealStatus::Resolved;
        deal.current_milestone = TERMINAL_MILESTONE;
        deal.resolution_outcome = outcome;
        deal.resolution_reason = reason;
        deal.resolved_at = now;
        assert_funded(deal)
    }

    pub fn cancel_unaccepted(ctx: Context<CancelUnaccepted>) -> Result<()> {
        let deal = &ctx.accounts.deal;
        require!(deal.status == DealStatus::AwaitingCreator, BazaarError::InvalidState);
        assert_funded(deal)?;
        transfer_from_escrow(
            &deal.to_account_info(),
            &ctx.accounts.client.to_account_info(),
            deal.remaining_budget_lamports,
            deal.rent_reserve_lamports,
        )?;
        let deal = &mut ctx.accounts.deal;
        deal.remaining_budget_lamports = 0;
        deal.status = DealStatus::Cancelled;
        deal.current_milestone = TERMINAL_MILESTONE;
        assert_funded(deal)
    }
}

#[derive(Accounts)]
#[instruction(deal_id: u64)]
pub struct CreateDeal<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(
        init,
        payer = client,
        space = 8 + Deal::INIT_SPACE,
        seeds = [b"deal", client.key().as_ref(), &deal_id.to_le_bytes()],
        bump
    )]
    pub deal: Account<'info, Deal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptDeal<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [b"deal", deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
        has_one = creator @ BazaarError::WrongRole
    )]
    pub deal: Account<'info, Deal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitMilestone<'info> {
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [b"deal", deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
        has_one = creator @ BazaarError::WrongRole
    )]
    pub deal: Account<'info, Deal>,
}

#[derive(Accounts)]
pub struct ApproveMilestone<'info> {
    pub client: Signer<'info>,
    /// CHECK: Address is constrained to the immutable creator stored in the deal.
    #[account(mut, address = deal.creator @ BazaarError::WrongRole)]
    pub creator: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"deal", deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
        has_one = client @ BazaarError::WrongRole
    )]
    pub deal: Account<'info, Deal>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub party: Signer<'info>,
    #[account(
        mut,
        seeds = [b"deal", deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump
    )]
    pub deal: Account<'info, Deal>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    pub arbiter: Signer<'info>,
    /// CHECK: Address is constrained to the immutable client stored in the deal.
    #[account(mut, address = deal.client @ BazaarError::WrongRole)]
    pub client: UncheckedAccount<'info>,
    /// CHECK: Address is constrained to the immutable creator stored in the deal.
    #[account(mut, address = deal.creator @ BazaarError::WrongRole)]
    pub creator: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"deal", deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
        has_one = arbiter @ BazaarError::WrongRole
    )]
    pub deal: Account<'info, Deal>,
}

#[derive(Accounts)]
pub struct CancelUnaccepted<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(
        mut,
        seeds = [b"deal", deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
        has_one = client @ BazaarError::WrongRole
    )]
    pub deal: Account<'info, Deal>,
}

#[account]
#[derive(InitSpace)]
pub struct Deal {
    pub deal_id: u64,
    pub client: Pubkey,
    pub creator: Pubkey,
    pub arbiter: Pubkey,
    #[max_len(64)]
    pub title: String,
    #[max_len(200)]
    pub brief: String,
    #[max_len(200)]
    pub references_url: String,
    pub template_version: u8,
    pub budget_lamports: u64,
    pub bond_lamports: u64,
    pub remaining_budget_lamports: u64,
    pub locked_bond_lamports: u64,
    pub rent_reserve_lamports: u64,
    pub status: DealStatus,
    pub current_milestone: u8,
    pub milestones: [Milestone; 3],
    pub dispute_opened_by: Pubkey,
    #[max_len(200)]
    pub dispute_reason: String,
    pub dispute_opened_at: i64,
    pub resolution_outcome: ResolutionOutcome,
    #[max_len(200)]
    pub resolution_reason: String,
    pub resolved_at: i64,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Milestone {
    pub amount_lamports: u64,
    pub due_at: i64,
    #[max_len(200)]
    pub url: String,
    pub sha256: [u8; 32],
    pub revision: u8,
    pub submitted_at: i64,
    pub paid_at: i64,
}

impl Milestone {
    fn new(amount_lamports: u64, due_at: i64) -> Self {
        Self {
            amount_lamports,
            due_at,
            url: String::new(),
            sha256: [0; 32],
            revision: 0,
            submitted_at: 0,
            paid_at: 0,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum DealStatus {
    AwaitingCreator,
    Active,
    Disputed,
    Completed,
    Resolved,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ResolutionOutcome {
    PayCurrent,
    Refund,
    CreatorBreach,
}

fn validate_text(value: &str, max_bytes: usize) -> Result<()> {
    require!(value.len() <= max_bytes && !value.trim().is_empty(), BazaarError::InvalidInput);
    Ok(())
}

fn validate_url(value: &str, allow_empty: bool) -> Result<()> {
    if allow_empty && value.is_empty() {
        return Ok(());
    }
    require!(value.len() <= 200, BazaarError::InvalidInput);
    let tail = value.strip_prefix("https://").ok_or(BazaarError::InvalidInput)?;
    // Keep the stored link unambiguous and safe for a browser HTTPS navigation.
    require!(
        !tail.is_empty()
            && !value.chars().any(|c| c.is_whitespace() || c.is_control() || c == '\\')
            && !tail.starts_with('/')
            && !tail.starts_with('?')
            && !tail.starts_with('#'),
        BazaarError::InvalidInput
    );
    let authority = tail.split(['/', '?', '#']).next().unwrap_or_default();
    require!(!authority.is_empty() && !authority.contains('@'), BazaarError::InvalidInput);
    Ok(())
}

fn checked_add(left: u64, right: u64) -> Result<u64> {
    left.checked_add(right).ok_or_else(|| error!(BazaarError::ArithmeticOverflow))
}

fn checked_sub(left: u64, right: u64) -> Result<u64> {
    left.checked_sub(right).ok_or_else(|| error!(BazaarError::ArithmeticOverflow))
}

fn split_budget(budget: u64) -> Result<[u64; 3]> {
    let concept = budget.checked_mul(20).ok_or(BazaarError::ArithmeticOverflow)? / 100;
    let draft = budget.checked_mul(30).ok_or(BazaarError::ArithmeticOverflow)? / 100;
    let final_amount = checked_sub(checked_sub(budget, concept)?, draft)?;
    Ok([concept, draft, final_amount])
}

fn assert_funded(deal: &Account<Deal>) -> Result<()> {
    let reserve_and_budget = checked_add(deal.rent_reserve_lamports, deal.remaining_budget_lamports)?;
    let obligations = checked_add(reserve_and_budget, deal.locked_bond_lamports)?;
    require!(deal.to_account_info().lamports() >= obligations, BazaarError::InsufficientFunds);
    Ok(())
}

fn transfer_from_escrow(
    escrow: &AccountInfo,
    recipient: &AccountInfo,
    amount: u64,
    rent_reserve: u64,
) -> Result<()> {
    require_keys_eq!(*escrow.owner, crate::ID, BazaarError::InvalidInput);
    require_keys_neq!(escrow.key(), recipient.key(), BazaarError::InvalidInput);
    if amount == 0 {
        return Ok(());
    }
    let after = escrow.lamports().checked_sub(amount).ok_or(BazaarError::InsufficientFunds)?;
    require!(after >= rent_reserve, BazaarError::InsufficientFunds);
    let recipient_after = checked_add(recipient.lamports(), amount)?;
    **escrow.try_borrow_mut_lamports()? = after;
    **recipient.try_borrow_mut_lamports()? = recipient_after;
    Ok(())
}

#[error_code]
pub enum BazaarError {
    #[msg("The signer or payment recipient does not match this deal's immutable role.")]
    WrongRole,
    #[msg("The input is invalid or exceeds an allowed bound.")]
    InvalidInput,
    #[msg("The action is unavailable in the deal's current state.")]
    InvalidState,
    #[msg("The milestone, revision, or file hash changed. Refresh before signing.")]
    StaleSubmission,
    #[msg("An initial submission and one replacement are allowed per milestone.")]
    RevisionLimit,
    #[msg("Escrow cannot cover its outstanding obligations and retained rent.")]
    InsufficientFunds,
    #[msg("Checked monetary arithmetic failed.")]
    ArithmeticOverflow,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn budget_splits_preserve_every_lamport() {
        for budget in [MIN_BUDGET, 1_000_001, 300_000_007, MAX_BUDGET] {
            let parts = split_budget(budget).unwrap();
            assert_eq!(parts[0], budget * 20 / 100);
            assert_eq!(parts[1], budget * 30 / 100);
            assert_eq!(parts.iter().sum::<u64>(), budget);
        }
        assert!(split_budget(u64::MAX).is_err());
    }

    #[test]
    fn bounds_count_utf8_bytes_and_reject_blank_input() {
        assert!(validate_text(&"a".repeat(64), 64).is_ok());
        assert!(validate_text(&"a".repeat(65), 64).is_err());
        assert!(validate_text(&"é".repeat(32), 64).is_ok());
        assert!(validate_text(&"é".repeat(33), 64).is_err());
        assert!(validate_text(" \n\t", 200).is_err());
    }

    #[test]
    fn stored_links_are_nonblank_https_without_ambiguous_authority() {
        assert!(validate_url("https://example.com/file?version=1#preview", false).is_ok());
        assert!(validate_url("", true).is_ok());
        for url in ["", "http://example.com/file", "javascript:alert(1)", "https://", "https:///file", "https://example.com/a b", "https://user@example.com/file", "https://example.com\\file"] {
            assert!(validate_url(url, false).is_err(), "unexpected accepted URL {url}");
        }
        assert!(validate_url(&format!("https://example.com/{}", "a".repeat(200)), false).is_err());
    }

    #[test]
    fn account_allocation_is_fixed_and_includes_all_maximum_strings() {
        assert_eq!(Milestone::INIT_SPACE, 269);
        assert_eq!(Deal::INIT_SPACE, 1896);
        let max_url = format!("https://example.com/{}", "a".repeat(180));
        assert_eq!(max_url.len(), 200);
        let milestone = Milestone {
            amount_lamports: 1,
            due_at: 1,
            url: max_url.clone(),
            sha256: [255; 32],
            revision: 2,
            submitted_at: 1,
            paid_at: 1,
        };
        let maximum = Deal {
            deal_id: u64::MAX,
            client: Pubkey::new_unique(),
            creator: Pubkey::new_unique(),
            arbiter: Pubkey::new_unique(),
            title: "a".repeat(64),
            brief: "a".repeat(200),
            references_url: max_url,
            template_version: 1,
            budget_lamports: MAX_BUDGET,
            bond_lamports: MAX_BUDGET / 10,
            remaining_budget_lamports: 0,
            locked_bond_lamports: 0,
            rent_reserve_lamports: 1,
            status: DealStatus::Resolved,
            current_milestone: TERMINAL_MILESTONE,
            milestones: [milestone.clone(), milestone.clone(), milestone],
            dispute_opened_by: Pubkey::new_unique(),
            dispute_reason: "a".repeat(200),
            dispute_opened_at: 1,
            resolution_outcome: ResolutionOutcome::PayCurrent,
            resolution_reason: "a".repeat(200),
            resolved_at: 1,
            created_at: 1,
            bump: 255,
        };
        let mut serialized = Vec::new();
        maximum.try_serialize(&mut serialized).unwrap();
        assert_eq!(serialized.len(), 8 + Deal::INIT_SPACE);
    }

    #[test]
    fn outgoing_payment_retains_rent_and_untouched_donations() {
        let escrow_key = Pubkey::new_unique();
        let recipient_key = Pubkey::new_unique();
        let program_owner = crate::ID;
        let recipient_owner = system_program::ID;
        let rent = 2_000;
        let budget = 10_003;
        let donation = 571;
        let mut escrow_balance = rent + budget + donation;
        let mut recipient_balance = 17;
        let mut escrow_data = [];
        let mut recipient_data = [];
        let escrow = AccountInfo::new(
            &escrow_key, false, true, &mut escrow_balance,
            &mut escrow_data, &program_owner, false, 0,
        );
        let recipient = AccountInfo::new(
            &recipient_key, false, true, &mut recipient_balance,
            &mut recipient_data, &recipient_owner, false, 0,
        );
        transfer_from_escrow(&escrow, &recipient, budget, rent).unwrap();
        assert_eq!(escrow.lamports(), rent + donation);
        assert_eq!(recipient.lamports(), 17 + budget);
        assert!(transfer_from_escrow(&escrow, &recipient, donation + 1, rent).is_err());
        assert_eq!(escrow.lamports(), rent + donation);
        assert_eq!(recipient.lamports(), 17 + budget);
    }

    #[test]
    fn recipient_overflow_and_alias_do_not_partially_debit_escrow() {
        let escrow_key = Pubkey::new_unique();
        let recipient_key = Pubkey::new_unique();
        let program_owner = crate::ID;
        let recipient_owner = system_program::ID;
        let mut escrow_balance = 10_000;
        let mut recipient_balance = u64::MAX;
        let mut escrow_data = [];
        let mut recipient_data = [];
        let escrow = AccountInfo::new(
            &escrow_key, false, true, &mut escrow_balance,
            &mut escrow_data, &program_owner, false, 0,
        );
        let recipient = AccountInfo::new(
            &recipient_key, false, true, &mut recipient_balance,
            &mut recipient_data, &recipient_owner, false, 0,
        );
        assert!(transfer_from_escrow(&escrow, &recipient, 1, 1_000).is_err());
        assert_eq!(escrow.lamports(), 10_000);
        assert_eq!(recipient.lamports(), u64::MAX);
        assert!(transfer_from_escrow(&escrow, &escrow, 1, 1_000).is_err());
        assert_eq!(escrow.lamports(), 10_000);
    }
}
