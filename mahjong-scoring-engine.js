// Pure Chinese Classical Mahjong scoring engine.
// No DOM access, no Supabase — every function takes plain data in and
// returns plain data out, so it can be reused unchanged across the lobby,
// game, and results pages.

const MAHJONG_SEATS = ['EAST', 'SOUTH', 'WEST', 'NORTH'];

const HAND_SECTIONS = [
    {
        id: 'limit',
        label: 'Limit Hands',
        winnerOnly: true,
        items: [
            { name: 'Three Big Dragons',  type: 'limit', value: 300, max: 1, ui: 'checkbox', radioGroup: 'limit' },
            { name: 'Thirteen Orphans',   type: 'limit', value: 300, max: 1, ui: 'checkbox', radioGroup: 'limit' },
            { name: 'Four Big Winds',     type: 'limit', value: 300, max: 1, ui: 'checkbox', radioGroup: 'limit' },
            { name: 'Nine Gates',         type: 'limit', value: 300, max: 1, ui: 'checkbox', radioGroup: 'limit' },
            { name: 'Blessing of Heaven', type: 'limit', value: 300, max: 1, ui: 'checkbox', radioGroup: 'limit' },
            { name: 'Blessing of Earth',  type: 'limit', value: 150, max: 1, ui: 'checkbox', radioGroup: 'limit' }
        ]
    },
    {
        id: 'doubles',
        label: 'Doubles',
        winnerOnly: false,
        items: [
            { name: 'Dragon Pung or Kong',      type: 'dbl', value: 1, max: 3, ui: 'stepper' },
            { name: 'Seat Wind Pung or Kong',   type: 'dbl', value: 1, max: 1, ui: 'checkbox' },
            { name: 'Round Wind Pung or Kong',  type: 'dbl', value: 1, max: 1, ui: 'checkbox' },
            { name: 'Seat Flower and Season',   type: 'dbl', value: 1, max: 1, ui: 'checkbox' },
            { name: 'Half Flush',               type: 'dbl', value: 1, max: 1, ui: 'checkbox', radioGroup: 'flush' },
            { name: 'Pure Flush',               type: 'dbl', value: 3, max: 1, ui: 'checkbox', radioGroup: 'flush' },
            { name: 'All Honors',               type: 'dbl', value: 3, max: 1, ui: 'checkbox', radioGroup: 'flush' },
            { name: 'All Four Flowers',         type: 'dbl', value: 3, max: 1, ui: 'checkbox' },
            { name: 'All Four Seasons',         type: 'dbl', value: 3, max: 1, ui: 'checkbox' }
        ]
    },
    {
        id: 'mini',
        label: 'Mini Points',
        winnerOnly: false,
        items: [
            { name: 'Pung of Simples',              type: 'pts', value: 2,  max: 4 },
            { name: 'Pung of Simples (c)',           type: 'pts', value: 4,  max: 4 },
            { name: 'Kong of Simples',               type: 'pts', value: 8,  max: 4 },
            { name: 'Kong of Simples (c)',            type: 'pts', value: 16, max: 4 },
            { name: 'Pung of Terminals',             type: 'pts', value: 4,  max: 4 },
            { name: 'Pung of Terminals (c)',          type: 'pts', value: 8,  max: 4 },
            { name: 'Kong of Terminals',             type: 'pts', value: 16, max: 4 },
            { name: 'Kong of Terminals (c)',          type: 'pts', value: 32, max: 4 },
            { name: 'Pung of Dragons',               type: 'pts', value: 4,  max: 3 },
            { name: 'Pung of Dragons (c)',            type: 'pts', value: 8,  max: 3 },
            { name: 'Kong of Dragons',               type: 'pts', value: 16, max: 3 },
            { name: 'Kong of Dragons (c)',            type: 'pts', value: 32, max: 3 },
            { name: 'Pung of Seat/Round Winds',      type: 'pts', value: 4,  max: 2 },
            { name: 'Pung of Seat/Round Winds (c)',   type: 'pts', value: 8,  max: 2 },
            { name: 'Kong of Seat/Round Winds',      type: 'pts', value: 16, max: 2 },
            { name: 'Kong of Seat/Round Winds (c)',   type: 'pts', value: 32, max: 2 },
            { name: 'Pair of Seat/Round Winds',      type: 'pts', value: 2,  max: 2 },
            { name: 'Pair of Dragons',               type: 'pts', value: 2,  max: 1 },
            { name: 'Each Seat Flower or Season',    type: 'pts', value: 2,  max: 2 }
        ]
    },
    {
        id: 'mini-winner',
        label: 'Mini Points — Winner Only',
        winnerOnly: true,
        items: [
            { name: 'Base Win',              type: 'pts', value: 20, max: 1, ui: 'auto' },
            { name: 'Pinghu',                type: 'pts', value: 10, max: 1, ui: 'checkbox' },
            { name: 'All Pungs',             type: 'pts', value: 10, max: 1, ui: 'checkbox' },
            { name: 'Replacement Tile Win',  type: 'pts', value: 10, max: 1, ui: 'checkbox' },
            { name: 'Last Tile Win',         type: 'pts', value: 10, max: 1, ui: 'checkbox' },
            { name: 'Self-Drawn Win',        type: 'pts', value: 2,  max: 1, ui: 'auto' },
            { name: 'Eyes Wait',             type: 'pts', value: 2,  max: 1, ui: 'checkbox', radioGroup: 'wait' },
            { name: 'Closed Wait',           type: 'pts', value: 2,  max: 1, ui: 'checkbox', radioGroup: 'wait' },
            { name: 'Edge Wait',             type: 'pts', value: 2,  max: 1, ui: 'checkbox', radioGroup: 'wait' }
        ]
    }
];

// selections: { checks: { '<sectionIndex>-<itemIndex>': true }, qtys: { '<sectionIndex>-<itemIndex>': n } }
function getSeatHandValues(seat, winner, selections) {
    let miniPts = 0;
    let doubles = 0;
    let limitPts = 0;
    const { checks = {}, qtys = {} } = selections || {};

    HAND_SECTIONS[0].items.forEach((item, ii) => {
        if (checks[`0-${ii}`]) limitPts = item.value;
    });

    HAND_SECTIONS.forEach((section, si) => {
        if (si === 0) return; // limit handled above
        if (section.winnerOnly && seat !== winner) return;
        section.items.forEach((item, ii) => {
            let qty = 0;
            if (item.ui === 'checkbox' || item.ui === 'auto') {
                qty = checks[`${si}-${ii}`] ? 1 : 0;
            } else {
                qty = qtys[`${si}-${ii}`] || 0;
            }
            if (qty === 0) return;
            if (item.type === 'pts') miniPts += item.value * qty;
            else if (item.type === 'dbl') doubles += item.value * qty;
        });
    });

    return { miniPts, doubles, limitPts };
}

function computePointTotal(seat, winner, selections) {
    const { miniPts, doubles, limitPts } = getSeatHandValues(seat, winner, selections);

    let total = (limitPts > 0)
        ? limitPts + miniPts
        : miniPts * Math.pow(2, doubles);

    const cap = 500;
    const capped = total > cap;
    return { total: Math.min(total, cap), rawTotal: total, capped, limitPts, miniPts, doubles };
}

function computeSeatDisplay(seat, winner, pointTotal, eastDoublingEnabled) {
    const { total, rawTotal, capped } = pointTotal;
    const cap = (seat === 'EAST' && eastDoublingEnabled) ? 1000 : 500;
    const isEastDoubled = eastDoublingEnabled && seat === 'EAST' && winner === 'EAST';
    let displayTotal = total;
    let realValue = rawTotal;
    if (isEastDoubled) {
        displayTotal = Math.min(total * 2, cap);
        realValue = rawTotal * 2;
    }
    const displayCapped = capped || displayTotal >= cap;
    return { displayTotal, realValue, isEastDoubled, displayCapped };
}

// selectionsBySeat: { EAST: selections, SOUTH: selections, ... } — missing
// seats are treated as an empty hand (all zeros).
function computeAllBaseScores(winner, eastDoublingEnabled, selectionsBySeat) {
    const baseScores = {};
    const details = {};
    MAHJONG_SEATS.forEach(seat => {
        const selections = (selectionsBySeat && selectionsBySeat[seat]) || { checks: {}, qtys: {} };
        const pointTotal = computePointTotal(seat, winner, selections);
        baseScores[seat] = pointTotal.total;
        details[seat] = Object.assign({}, pointTotal, computeSeatDisplay(seat, winner, pointTotal, eastDoublingEnabled));
    });
    return { baseScores, details };
}

function computePayoutMatrix({ winner, discardedByRaw, eastDoublingEnabled, discarderPaysDoubleEnabled, discarderPaysAllEnabled, baseScores }) {
    const discardedBy = (winner === 'NONE') ? 'SELFDRAW' : discardedByRaw;
    const isSelfDraw = (discardedBy === 'SELFDRAW');
    const discarder = isSelfDraw ? '' : discardedBy;

    const matrix = {
        EAST:  { EAST: 0, SOUTH: 0, WEST: 0, NORTH: 0 },
        SOUTH: { EAST: 0, SOUTH: 0, WEST: 0, NORTH: 0 },
        WEST:  { EAST: 0, SOUTH: 0, WEST: 0, NORTH: 0 },
        NORTH: { EAST: 0, SOUTH: 0, WEST: 0, NORTH: 0 }
    };

    MAHJONG_SEATS.forEach(p1 => {
        MAHJONG_SEATS.forEach(p2 => {
            if (p1 === p2) return;
            if (p1 === winner) return;

            if (p2 === winner) {
                let baseWinValue = baseScores[winner];

                if (isSelfDraw) {
                    let payout = baseWinValue;
                    if (eastDoublingEnabled && (p1 === 'EAST' || p2 === 'EAST')) {
                        payout *= 2;
                    }
                    matrix[p1][p2] = -payout;
                    matrix[p2][p1] = payout;
                } else if (discarderPaysAllEnabled) {
                    if (p1 === discarder) {
                        let totalPayout = 0;
                        MAHJONG_SEATS.forEach(loser => {
                            if (loser === winner) return;
                            let payout = baseWinValue;
                            if (eastDoublingEnabled && (loser === 'EAST' || winner === 'EAST')) {
                                payout *= 2;
                            }
                            totalPayout += payout;
                        });
                        matrix[p1][p2] = -totalPayout;
                        matrix[p2][p1] = totalPayout;
                    } else {
                        matrix[p1][p2] = 0;
                    }
                } else if (discarderPaysDoubleEnabled) {
                    if (p1 === discarder) {
                        let payout = baseWinValue * 2;
                        if (eastDoublingEnabled && (p1 === 'EAST' || p2 === 'EAST')) {
                            payout *= 2;
                        }
                        matrix[p1][p2] = -payout;
                        matrix[p2][p1] = payout;
                    } else {
                        matrix[p1][p2] = 0;
                    }
                } else {
                    let payout = baseWinValue;
                    if (eastDoublingEnabled && (p1 === 'EAST' || p2 === 'EAST')) {
                        payout *= 2;
                    }
                    matrix[p1][p2] = -payout;
                    matrix[p2][p1] = payout;
                }
            }

            else if (p2 !== winner) {
                if (baseScores[p1] > baseScores[p2]) {
                    let diff = baseScores[p1] - baseScores[p2];
                    if (eastDoublingEnabled && (p1 === 'EAST' || p2 === 'EAST')) {
                        diff *= 2;
                    }
                    matrix[p1][p2] = diff;
                    matrix[p2][p1] = -diff;
                }
            }
        });
    });

    const netResults = {};
    MAHJONG_SEATS.forEach(p1 => {
        let net = 0;
        MAHJONG_SEATS.forEach(p2 => {
            if (p1 === p2) return;
            net += matrix[p1][p2];
        });
        netResults[p1] = net;
    });

    return { matrix, netResults };
}
