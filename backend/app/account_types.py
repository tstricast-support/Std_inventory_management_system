# Every account type -> the Zoho-style category it belongs to.
# (Keys must stay <= 20 characters: that is the size of accounts.account_type.)
# "asset", "income" and "cogs" are the original item-linked types and keep working as before.
ACCOUNT_CATEGORY = {
    # Assets
    "cash": "Asset",
    "bank": "Asset",
    "accounts_receivable": "Asset",
    "other_current_asset": "Asset",
    "asset": "Asset",              # stock / inventory asset (linked to items)
    "fixed_asset": "Asset",
    # Liabilities
    "accounts_payable": "Liability",
    "credit_card": "Liability",
    "current_liability": "Liability",
    "long_term_liability": "Liability",
    # Equity
    "equity": "Equity",
    # Income
    "income": "Income",            # sales income (linked to items)
    "other_income": "Income",
    # Expenses
    "cogs": "Expense",             # cost of goods sold (linked to items)
    "expense": "Expense",
    "other_expense": "Expense",
}

# Assets and expenses grow with a debit; everything else grows with a credit.
DEBIT_NORMAL = {"Asset", "Expense"}

# Created once, the first time the app starts after this step (like Zoho's default accounts).
DEFAULT_ACCOUNTS = [
    ("Accounts Receivable", "accounts_receivable"),
    ("Accounts Payable", "accounts_payable"),
    ("Petty Cash", "cash"),
    ("Undeposited Funds", "other_current_asset"),
    ("Opening Balance Offset", "equity"),
    ("Retained Earnings", "equity"),
]