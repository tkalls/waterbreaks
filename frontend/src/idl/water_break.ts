/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/water_break.json`.
 */
export type WaterBreak = {
  "address": "HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z",
  "metadata": {
    "name": "waterBreak",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Water Break - World Cup water-break prediction market on Solana"
  },
  "instructions": [
    {
      "name": "claimWinnings",
      "docs": [
        "Each winner calls this once. Payout is their proportional share of the",
        "entire pool based on how much they staked on the winning option:",
        "payout = bet.amount * total_pool / option_pools[winning_option]",
        "This is a pull-based claim so it scales to any number of bettors",
        "without one instruction looping over an unbounded account list."
      ],
      "discriminator": [
        161,
        215,
        24,
        59,
        14,
        236,
        242,
        221
      ],
      "accounts": [
        {
          "name": "better",
          "writable": true,
          "signer": true,
          "relations": [
            "bet"
          ]
        },
        {
          "name": "round",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_id",
                "account": "round"
              }
            ]
          }
        },
        {
          "name": "bet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round"
              },
              {
                "kind": "account",
                "path": "better"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initializeRound",
      "docs": [
        "Admin creates a new prediction round for the upcoming water break.",
        "`duration_secs` is how long the betting window stays open (e.g. 90)."
      ],
      "discriminator": [
        43,
        135,
        19,
        93,
        14,
        225,
        131,
        188
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "round",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "roundId"
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
          "name": "roundId",
          "type": "u64"
        },
        {
          "name": "optionA",
          "type": "string"
        },
        {
          "name": "optionB",
          "type": "string"
        },
        {
          "name": "optionC",
          "type": "string"
        },
        {
          "name": "durationSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "placeBet",
      "docs": [
        "Fan stakes `amount` lamports on `option` (0, 1, or 2)."
      ],
      "discriminator": [
        222,
        62,
        67,
        220,
        63,
        166,
        126,
        33
      ],
      "accounts": [
        {
          "name": "better",
          "writable": true,
          "signer": true
        },
        {
          "name": "round",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_id",
                "account": "round"
              }
            ]
          }
        },
        {
          "name": "bet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round"
              },
              {
                "kind": "account",
                "path": "better"
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
          "name": "option",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveRound",
      "docs": [
        "Admin-only. Locks in the correct outcome once the break ends and the",
        "match resumes. Must be called after the deadline has passed."
      ],
      "discriminator": [
        165,
        114,
        237,
        158,
        1,
        36,
        70,
        254
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "round"
          ]
        },
        {
          "name": "round",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_id",
                "account": "round"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "winningOption",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bet",
      "discriminator": [
        147,
        23,
        35,
        59,
        15,
        75,
        155,
        32
      ]
    },
    {
      "name": "round",
      "discriminator": [
        87,
        127,
        165,
        51,
        73,
        78,
        116,
        174
      ]
    }
  ],
  "events": [
    {
      "name": "betPlaced",
      "discriminator": [
        88,
        88,
        145,
        226,
        126,
        206,
        32,
        0
      ]
    },
    {
      "name": "roundInitialized",
      "discriminator": [
        238,
        116,
        151,
        217,
        19,
        157,
        254,
        83
      ]
    },
    {
      "name": "roundResolved",
      "discriminator": [
        204,
        146,
        253,
        187,
        8,
        61,
        75,
        29
      ]
    },
    {
      "name": "winningsClaimed",
      "discriminator": [
        187,
        184,
        29,
        196,
        54,
        117,
        70,
        150
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "optionTooLong",
      "msg": "Option label too long (max 32 chars)"
    },
    {
      "code": 6001,
      "name": "roundResolved",
      "msg": "This round has already been resolved"
    },
    {
      "code": 6002,
      "name": "bettingClosed",
      "msg": "Betting window has closed for this round"
    },
    {
      "code": 6003,
      "name": "bettingStillOpen",
      "msg": "Betting window is still open"
    },
    {
      "code": 6004,
      "name": "invalidOption",
      "msg": "Invalid prediction option"
    },
    {
      "code": 6005,
      "name": "zeroAmount",
      "msg": "Stake amount must be greater than zero"
    },
    {
      "code": 6006,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6007,
      "name": "unauthorized",
      "msg": "Only the round authority can resolve it"
    },
    {
      "code": 6008,
      "name": "roundNotResolved",
      "msg": "Round has not been resolved yet"
    },
    {
      "code": 6009,
      "name": "alreadyClaimed",
      "msg": "Winnings already claimed"
    },
    {
      "code": 6010,
      "name": "notAWinner",
      "msg": "This bet did not pick the winning option"
    },
    {
      "code": 6011,
      "name": "noWinningPool",
      "msg": "No winning pool to distribute from"
    }
  ],
  "types": [
    {
      "name": "bet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "better",
            "type": "pubkey"
          },
          {
            "name": "round",
            "type": "pubkey"
          },
          {
            "name": "option",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "betPlaced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round",
            "type": "pubkey"
          },
          {
            "name": "better",
            "type": "pubkey"
          },
          {
            "name": "option",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "totalPool",
            "type": "u64"
          },
          {
            "name": "betCount",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "round",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "options",
            "type": {
              "array": [
                "string",
                3
              ]
            }
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "resolved",
            "type": "bool"
          },
          {
            "name": "winningOption",
            "type": "u8"
          },
          {
            "name": "optionPools",
            "type": {
              "array": [
                "u64",
                3
              ]
            }
          },
          {
            "name": "totalPool",
            "type": "u64"
          },
          {
            "name": "betCount",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "roundInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round",
            "type": "pubkey"
          },
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "deadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "roundResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round",
            "type": "pubkey"
          },
          {
            "name": "winningOption",
            "type": "u8"
          },
          {
            "name": "totalPool",
            "type": "u64"
          },
          {
            "name": "winningPool",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "winningsClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round",
            "type": "pubkey"
          },
          {
            "name": "better",
            "type": "pubkey"
          },
          {
            "name": "payout",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
