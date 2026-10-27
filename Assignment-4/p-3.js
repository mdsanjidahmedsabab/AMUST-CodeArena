function bestTeam(player1, player2) {
    if (typeof player1 !== "object" || typeof player2 !== "object") {
        return "Invalid";
    }


    const firstFoul = player1.foul;
    const secondFoul = player2.foul;
    const firstCardY = player1.cardY;
    const secondCardY = player2.cardY;
    const firstCardR = player1.cardR;
    const secondCardR = player2.cardR;
    const firstTotal = firstFoul + firstCardY + firstCardR;
    const secondTotal = secondFoul + secondCardY + secondCardR;

    if (firstTotal < secondTotal) {
        return player1.name;
    } else if (secondTotal < firstTotal) {
        return player2.name;
    }

    else {
        return 'Tie';
    }
}



