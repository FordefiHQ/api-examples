contact_type — a top-level field on each contact object.
Values on write: "contract" | "recipient". Required on create, batch create, and edit.

Single create — POST /api/v1/addressbook/contacts
request_json = {
    "name": "RouterMcRouty",
    "type": "evm",
    "contact_type": "contract",
    "address": "0x......",
    "chains": ["evm_ethereum_mainnet"]
}

Batch — POST /api/v1/addressbook/contacts/batch (per item)
request_json = {
    "contacts": [
        {
            "name": "My Ethereum Contact",
            "type": "evm",
            "contact_type": "recipient",
            "address": "0x7D8D7e776aC41c5F819965b2E288b2D03fe517aE",
            "chains": ["evm_ethereum_mainnet"]
        },
        {
            "name": "My Base Contact",
            "type": "evm",
            "contact_type": "recipient",
            "address": "0x8D1A4e041A3080d9a4170e7606B5255c23298886",
            "chains": ["evm_base_mainnet"]
        }
    ]
}

Edit — POST /api/v1/addressbook/contacts/{id}/proposals
request_json = {
    "name": "RouterMcRouty",
    "type": "evm",
    "contact_type": "contract",
    "chains": ["evm_ethereum_mainnet"]
}

Read paths return a third value,"unset"— contacts stored before the field existed. It's not settable - the next edit must assign a real type.