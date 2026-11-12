"""Twenty things that happen on the road between towns (docs/DATA.md section 12).

Each event has a `weight` (relative draw chance) and 2-3 `choices`. `effects` keys: `funds` (int, spendable money),
`morale` (int, the troupe's mood, small), `rapport` ({performer id: int}), `encore` (int, Encore tokens).
Labels announce funds and Encore changes in brackets; morale and rapport are discovered by playing.
"""

from __future__ import annotations


def _fx(funds=0, morale=0, rapport=None, encore=0):
    out = {"funds": funds, "morale": morale}
    if rapport:
        out["rapport"] = rapport
    if encore:
        out["encore"] = encore
    return out


def _choice(id, label, **effects):
    return {"id": id, "label": label, "effects": _fx(**effects)}


ROAD_EVENTS = [
    # --- geese (the goose is a performer, a hazard and a mascot) -------------------------------------------------
    {
        "id": "goose_on_the_bridge",
        "title": "A goose holds the bridge",
        "text": "A goose stands mid-bridge with the posture of a toll collector and the eyes of a magistrate. The wagon waits.",
        "weight": 3,
        "choices": [
            _choice("bribe", "Offer bread (-1 fund)", funds=-1, rapport={"goose": 1}),
            _choice("detour", "Take the long way round", morale=-1),
            _choice("negotiate", "Send our own goose to negotiate (-2 funds)", funds=-2, morale=1, rapport={"goose": 2}),
        ],
    },
    {
        "id": "goose_nest_in_the_trunk",
        "title": "A nest in the costume trunk",
        "text": "Overnight the goose has built a nest in the costume trunk. The wig is, apparently, the egg. Nobody has asked.",
        "weight": 2,
        "choices": [
            _choice("leave_it", "Leave the nest alone", morale=1, rapport={"goose": 2}),
            _choice("move_it", "Move the goose, gently; rescue the wig", rapport={"goose": -1, "hortensia": 2}),
            _choice("sell_tickets", "Sell tickets to the nesting (+2 funds)", funds=2, rapport={"goose": -1}),
        ],
    },
    {
        "id": "goose_trophy",
        "title": "The goose presents a trophy",
        "text": "The goose approaches with a small brass trophy found in a ditch. It reads BEST IN SHOW, 1962. It looks at you.",
        "weight": 1,
        "choices": [
            _choice("accept", "Accept it graciously (+1 Encore)", encore=1, rapport={"goose": 1}),
            _choice("give_to_madame", "Present it to Madame instead", morale=2, rapport={"goose": -1}),
        ],
    },
    {
        "id": "weighbridge_mystery",
        "title": "The weighbridge disagrees",
        "text": "The weighbridge says the wagon is two geese heavier than last week. We carry one goose. Nobody asks the other question.",
        "weight": 2,
        "choices": [
            _choice("pay", "Pay the overweight fee (-2 funds)", funds=-2, rapport={"tock": 1}),
            _choice("dispute", "Dispute the figures, loudly", morale=-1),
            _choice("weigh_goose", "Weigh the goose alone, for science (-1 fund)", funds=-1, morale=1, rapport={"goose": 1}),
        ],
    },
    # --- the road itself --------------------------------------------------------------------------------------------
    {
        "id": "broken_wheel",
        "title": "The wagon loses a wheel",
        "text": "The back left wheel departs quietly, like a guest who has overstayed. The wagon lowers itself with great dignity.",
        "weight": 3,
        "choices": [
            _choice("wheelwright", "Hire the wheelwright (-3 funds)", funds=-3, morale=1),
            _choice("ask_tock", "Ask Mr. Tock to improvise (-1 fund)", funds=-1, rapport={"tock": 2}),
            _choice("prop_it_up", "Prop it up with a painted tree", morale=-1),
        ],
    },
    {
        "id": "upside_down_map",
        "title": "Madame's map",
        "text": "Madame holds the map upside down with total conviction. The road, she says, is simply being modest.",
        "weight": 2,
        "choices": [
            _choice("trust_madame", "Trust Madame (-2 funds)", funds=-2, morale=2),
            _choice("ask_farmer", "Ask a farmer for directions (-1 fund)", funds=-1, rapport={"tock": 1}),
            _choice("follow_sheep", "Follow the sheep, Captain Nutt leading (-1 fund)", funds=-1, morale=1, rapport={"bartleby": 1}),
        ],
    },
    {
        "id": "fog_and_cow",
        "title": "A fog with a cow in it",
        "text": "Fog sits on the road with no plans. Somewhere inside it, a cow is explaining itself to nobody.",
        "weight": 2,
        "choices": [
            _choice("wait", "Wait for it to leave", morale=-1, rapport={"gus": 2}),
            _choice("follow_cow", "Follow the cow (+1 fund)", funds=1, morale=1, rapport={"goose": -1}),
            _choice("by_ear", "Drive on by ear (-1 fund)", funds=-1, rapport={"tock": 1}),
        ],
    },
    {
        "id": "barn_pigeons",
        "title": "A barn full of pigeons",
        "text": "Rain arrives sideways. A barn offers shelter and, on the rafters, an attentive audience of several hundred pigeons.",
        "weight": 2,
        "choices": [
            _choice("perform", "Perform for the rafters (+1 fund)", funds=1, morale=1),
            _choice("sit_it_out", "Sit out the storm with Gus", rapport={"gus": 2}),
            _choice("let_hortensia_sing", "Let Hortensia sing to them", morale=1, rapport={"hortensia": 2}),
        ],
    },
    {
        "id": "slow_parade",
        "title": "A parade for a marrow",
        "text": "A parade approaches at the speed of thought. It is in honour of a marrow. The marrow waves.",
        "weight": 1,
        "choices": [
            _choice("join", "Join the parade (-1 fund for ribbons)", funds=-1, morale=2),
            _choice("sell_programmes", "Sell programmes to the crowd (+2 funds)", funds=2, morale=-1),
            _choice("poppet_float", "Let Poppet ride the float", morale=1, rapport={"poppet": 2}),
        ],
    },
    # --- encounters ---------------------------------------------------------------------------------------------------
    {
        "id": "cyclist_fan",
        "title": "A fan on a bicycle",
        "text": "A woman on a bicycle has followed the wagon for six miles to say that Mabel's left side is her favourite.",
        "weight": 2,
        "choices": [
            _choice("lantern", "Let her carry the lantern", morale=1, rapport={"mabel": 2}),
            _choice("programme", "Sell her a programme (+1 fund)", funds=1, rapport={"mabel": 1}),
            _choice("wave", "Wave and keep going", rapport={"tock": 1}),
        ],
    },
    {
        "id": "polite_highwaymen",
        "title": "Two very polite highwaymen",
        "text": "Two highwaymen stop the wagon, apologise for it, and ask whether you have anything small and sentimental.",
        "weight": 2,
        "choices": [
            _choice("hand_over", "Hand over a small prop (-1 fund)", funds=-1, morale=1),
            _choice("out_apologise", "Let Reginald out-apologise them", rapport={"reginald": 2}),
            _choice("short_play", "Offer them a short play (+1 fund)", funds=1, morale=-1),
        ],
    },
    {
        "id": "village_fete",
        "title": "The fete needs an entertainment",
        "text": "A village fete is short of a turn. The vicar asks for something with a dying fall. Everyone looks at Reginald, who apologises.",
        "weight": 2,
        "choices": [
            _choice("scene", "Perform a short scene (+2 funds)", funds=2, morale=-1, rapport={"reginald": 1}),
            _choice("tombola", "Run the tombola (+1 fund)", funds=1, morale=1),
            _choice("buy_cake", "Buy a cake and move on (-1 fund)", funds=-1, morale=2),
        ],
    },
    {
        "id": "dry_lighthouse",
        "title": "The keeper of a dry lighthouse",
        "text": "A lighthouse keeper has waited eleven years for an audience, and would like the whole show, in the kitchen, now.",
        "weight": 1,
        "choices": [
            _choice("kitchen_show", "Perform in the kitchen (-1 fund for candles)", funds=-1, morale=2, rapport={"mabel": 1}),
            _choice("promise", "Promise to come back someday", morale=-1),
        ],
    },
    {
        "id": "inn_ghost",
        "title": "The inn's ghost wants a part",
        "text": "The innkeeper's resident ghost offers free rooms in exchange for a speaking part. It would like to play the Butler.",
        "weight": 1,
        "choices": [
            _choice("accept_terms", "Accept the ghost's terms (+2 funds)", funds=2, morale=-1),
            _choice("silent_part", "Offer a non-speaking part (+1 fund)", funds=1, morale=1),
            _choice("pay_rooms", "Pay for the rooms (-2 funds)", funds=-2, morale=2),
        ],
    },
    # --- the company ---------------------------------------------------------------------------------------------------
    {
        "id": "gus_and_the_hedge",
        "title": "Gus has found a hedge",
        "text": "Gus has stopped to study a hedge. Gus knows every part, has never been on a stage, and finds hedges reassuring.",
        "weight": 1,
        "choices": [
            _choice("biscuit", "Coax Gus back with a biscuit (-1 fund)", funds=-1, rapport={"gus": 2}),
            _choice("study", "Study the hedge together", morale=1, rapport={"gus": 1}),
            _choice("catch_up", "Let Gus catch up on foot (+1 fund)", funds=1, morale=-1, rapport={"gus": -1}),
        ],
    },
    {
        "id": "hortensia_wont_leave",
        "title": "Hortensia will not leave the wagon",
        "text": "Hortensia refuses to leave the wagon until someone says 'darling' in precisely the right key. Nobody knows the key.",
        "weight": 1,
        "choices": [
            _choice("say_darling", "Say 'darling' warmly", morale=1, rapport={"hortensia": 1}),
            _choice("mirror", "Offer her a mirror (-1 fund)", funds=-1, rapport={"hortensia": 2}),
            _choice("wrong_key", "Say it in the wrong key, defiantly", morale=2, rapport={"hortensia": -1}),
        ],
    },
    {
        "id": "talent_scout_for_poppet",
        "title": "A man in a checked waistcoat",
        "text": "A man in a checked waistcoat offers Poppet a three-year contract. Poppet is seven and has read it twice.",
        "weight": 1,
        "choices": [
            _choice("decline", "Decline politely", morale=1, rapport={"poppet": 1}),
            _choice("counter", "Let Poppet counter-offer (+2 funds)", funds=2, morale=-1, rapport={"poppet": 1}),
        ],
    },
    {
        "id": "scarecrow_captain",
        "title": "Captain Nutt salutes a scarecrow",
        "text": "Captain Bartleby Nutt has mistaken a scarecrow for a senior officer and has been saluting for twenty minutes.",
        "weight": 1,
        "choices": [
            _choice("salute", "Salute too", morale=1, rapport={"bartleby": 1}),
            _choice("promote", "Promote the scarecrow to Lieutenant (-1 fund)", funds=-1, morale=2, rapport={"bartleby": 2}),
            _choice("explain", "Explain, kindly (+1 fund: tip from the farmer)", funds=1, morale=-1, rapport={"bartleby": -1}),
        ],
    },
    # --- the two that can pay out an Encore token (besides the goose's trophy) ------------------------------------
    {
        "id": "clockmaker_rewind",
        "title": "A clockmaker offers a rewind",
        "text": "A very loud clockmaker offers to wind Mr. Tock's spring backwards by exactly one hour, give or take.",
        "weight": 1,
        "choices": [
            _choice("accept_rewind", "Accept the rewind (-2 funds, +1 Encore)", funds=-2, encore=1),
            _choice("spare_spring", "Buy Tock a spare spring (-1 fund)", funds=-1, rapport={"tock": 2}),
            _choice("forward_only", "Decline; Mr. Tock prefers forward", morale=1, rapport={"tock": 1}),
        ],
    },
    {
        "id": "old_actor_ticket",
        "title": "A ticket from a retired actor",
        "text": "On a bench, a retired actor presses a worn ticket into your hand. ADMIT ONE MORE TIME. 'It still works,' they whisper.",
        "weight": 1,
        "choices": [
            _choice("take_ticket", "Take the ticket (+1 Encore)", encore=1),
            _choice("ask_notes", "Ask for notes first (-1 fund)", funds=-1, morale=1, rapport={"mabel": 1}),
        ],
    },
]

DATASETS = {"road_events": ROAD_EVENTS}
