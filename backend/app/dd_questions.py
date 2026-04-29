from typing import List, TypedDict


class DDQuestion(TypedDict):
    id: str
    category: str
    prompt: str


DD_QUESTIONS: List[DDQuestion] = [
    {
        "id": "market-tam",
        "category": "Market",
        "prompt": (
            "What is the company's addressable market and current penetration? "
            "Cross-check the headline TAM figure against the realistic addressable opportunity for the "
            "company's segment and geography. Flag any inflation between the two."
        ),
    },
    {
        "id": "competitive-moat",
        "category": "Competitive",
        "prompt": (
            "Who are the direct competitors and what is the company's defensible moat? "
            "Consider vertical specialisation, switching cost, integration depth, and data assets. "
            "Are competitors gaining or losing ground?"
        ),
    },
    {
        "id": "commercial-concentration",
        "category": "Commercial",
        "prompt": (
            "What is the customer concentration risk? Identify top-N customers as a share of ARR, "
            "contract durations, and any near-term opt-out windows or change-of-control triggers in "
            "top contracts."
        ),
    },
    {
        "id": "commercial-retention",
        "category": "Commercial",
        "prompt": (
            "What is the company's net revenue retention (NRR) and gross retention by cohort? "
            "Is growth quality consistent across cohorts, or driven by a single account or product upsell?"
        ),
    },
    {
        "id": "financial-arr-recon",
        "category": "Financial",
        "prompt": (
            "Are ARR figures consistent across all documents in the data room? Quote each ARR figure you "
            "find and the document it appears in. Flag any discrepancy (for example contracted ARR vs. "
            "annualised MRR run-rate)."
        ),
    },
    {
        "id": "financial-runway",
        "category": "Financial",
        "prompt": (
            "What is the cash position, monthly burn, implied runway, and stated path to profitability? "
            "Is the EBITDA-breakeven plan credible given the trajectory in the financials?"
        ),
    },
    {
        "id": "contracts-risk",
        "category": "Contracts",
        "prompt": (
            "Which top contracts have near-term opt-out windows, most-favoured-customer clauses, or "
            "change-of-control termination rights? Quantify the at-risk ARR."
        ),
    },
    {
        "id": "operational-key-person",
        "category": "Operational",
        "prompt": (
            "What key-person risk exists across founders and senior leadership? "
            "Note any vacant roles, recent departures, or single-point-of-failure dependencies."
        ),
    },
    {
        "id": "strategy-credibility",
        "category": "Strategy",
        "prompt": (
            "Does the stated growth plan reconcile with the assumptions presented? "
            "Test the path to the headline ARR target against attach rate, new-logo, and "
            "geographic-expansion assumptions."
        ),
    },
    {
        "id": "risk-gaps",
        "category": "Risk",
        "prompt": (
            "What contradicts across documents and what is missing that a commercial DD consultant would "
            "expect? Be specific about each contradiction and each gap (for example audited accounts, "
            "detailed churn data, sales pipeline beyond pipeline contracts, product roadmap)."
        ),
    },
]
