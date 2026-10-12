/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/aic_bazaar.json`.
 */
export type AicBazaar = {
  "address": "8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX",
  "metadata": {
    "name": "aicBazaar",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "AIC Bazaar milestone escrow, Devnet MVP"
  },
  "instructions": [
    {
      "name": "acceptDeal",
      "discriminator": [
        76,
        156,
        34,
        30,
        129,
        136,
        76,
        244
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "deal"
          ]
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.deal_id",
                "account": "deal"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "approveMilestone",
      "discriminator": [
        145,
        85,
        92,
        60,
        50,
        130,
        219,
        106
      ],
      "accounts": [
        {
          "name": "client",
          "signer": true,
          "relations": [
            "deal"
          ]
        },
        {
          "name": "creator",
          "writable": true
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.deal_id",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "expectedRevision",
          "type": "u8"
        },
        {
          "name": "expectedHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "cancelUnaccepted",
      "discriminator": [
        165,
        153,
        32,
        101,
        199,
        134,
        68,
        50
      ],
      "accounts": [
        {
          "name": "client",
          "writable": true,
          "signer": true,
          "relations": [
            "deal"
          ]
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.deal_id",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "createDeal",
      "discriminator": [
        198,
        212,
        144,
        151,
        97,
        56,
        149,
        113
      ],
      "accounts": [
        {
          "name": "client",
          "writable": true,
          "signer": true
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "client"
              },
              {
                "kind": "arg",
                "path": "dealId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "dealId",
          "type": "u64"
        },
        {
          "name": "creator",
          "type": "pubkey"
        },
        {
          "name": "arbiter",
          "type": "pubkey"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "brief",
          "type": "string"
        },
        {
          "name": "referencesUrl",
          "type": "string"
        },
        {
          "name": "budgetLamports",
          "type": "u64"
        },
        {
          "name": "deadlines",
          "type": {
            "array": [
              "i64",
              3
            ]
          }
        }
      ]
    },
    {
      "name": "openDispute",
      "discriminator": [
        137,
        25,
        99,
        119,
        23,
        223,
        161,
        42
      ],
      "accounts": [
        {
          "name": "party",
          "signer": true
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.deal_id",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "resolveDispute",
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "arbiter",
          "signer": true,
          "relations": [
            "deal"
          ]
        },
        {
          "name": "client",
          "writable": true
        },
        {
          "name": "creator",
          "writable": true
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.deal_id",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "outcome",
          "type": {
            "defined": {
              "name": "resolutionOutcome"
            }
          }
        },
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "submitMilestone",
      "discriminator": [
        35,
        96,
        220,
        215,
        102,
        83,
        139,
        52
      ],
      "accounts": [
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "deal"
          ]
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.deal_id",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "url",
          "type": "string"
        },
        {
          "name": "sha256",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "expectedRevision",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "deal",
      "discriminator": [
        125,
        223,
        160,
        234,
        71,
        162,
        182,
        219
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "wrongRole",
      "msg": "The signer or payment recipient does not match this deal's immutable role."
    },
    {
      "code": 6001,
      "name": "invalidInput",
      "msg": "The input is invalid or exceeds an allowed bound."
    },
    {
      "code": 6002,
      "name": "invalidState",
      "msg": "The action is unavailable in the deal's current state."
    },
    {
      "code": 6003,
      "name": "staleSubmission",
      "msg": "The milestone, revision, or file hash changed. Refresh before signing."
    },
    {
      "code": 6004,
      "name": "revisionLimit",
      "msg": "An initial submission and one replacement are allowed per milestone."
    },
    {
      "code": 6005,
      "name": "insufficientFunds",
      "msg": "Escrow cannot cover its outstanding obligations and retained rent."
    },
    {
      "code": 6006,
      "name": "arithmeticOverflow",
      "msg": "Checked monetary arithmetic failed."
    }
  ],
  "types": [
    {
      "name": "deal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dealId",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "arbiter",
            "type": "pubkey"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "brief",
            "type": "string"
          },
          {
            "name": "referencesUrl",
            "type": "string"
          },
          {
            "name": "templateVersion",
            "type": "u8"
          },
          {
            "name": "budgetLamports",
            "type": "u64"
          },
          {
            "name": "bondLamports",
            "type": "u64"
          },
          {
            "name": "remainingBudgetLamports",
            "type": "u64"
          },
          {
            "name": "lockedBondLamports",
            "type": "u64"
          },
          {
            "name": "rentReserveLamports",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "dealStatus"
              }
            }
          },
          {
            "name": "currentMilestone",
            "type": "u8"
          },
          {
            "name": "milestones",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "milestone"
                  }
                },
                3
              ]
            }
          },
          {
            "name": "disputeOpenedBy",
            "type": "pubkey"
          },
          {
            "name": "disputeReason",
            "type": "string"
          },
          {
            "name": "disputeOpenedAt",
            "type": "i64"
          },
          {
            "name": "resolutionOutcome",
            "type": {
              "defined": {
                "name": "resolutionOutcome"
              }
            }
          },
          {
            "name": "resolutionReason",
            "type": "string"
          },
          {
            "name": "resolvedAt",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "dealStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "awaitingCreator"
          },
          {
            "name": "active"
          },
          {
            "name": "disputed"
          },
          {
            "name": "completed"
          },
          {
            "name": "resolved"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "milestone",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amountLamports",
            "type": "u64"
          },
          {
            "name": "dueAt",
            "type": "i64"
          },
          {
            "name": "url",
            "type": "string"
          },
          {
            "name": "sha256",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "revision",
            "type": "u8"
          },
          {
            "name": "submittedAt",
            "type": "i64"
          },
          {
            "name": "paidAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "resolutionOutcome",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "payCurrent"
          },
          {
            "name": "refund"
          },
          {
            "name": "creatorBreach"
          }
        ]
      }
    }
  ]
};
