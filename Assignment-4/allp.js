function totalFine(fare) {
    if (fare <= 0, typeof fare !== "number") {
        return "Invalid";
    }
    else { return fare + fare * .2 + 30; }
}


function onlyCharacter(str) {
    if (typeof str !== "string") {
        return "Invalid";
    }
    let result = "";

    for (let index = 0; index < str.length; index++) {
        let element = str[index];
        if (element !== " ") {
            result = result + element;
        }
    }

    return result.toUpperCase();;
}

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


function isSame(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
        return "Invalid";
    }
    for (let i = 0; i < arr1.length; i++) {
        const firstElement = arr1[i];
        const secondElement = arr2[i];

        if (firstElement !== secondElement) {
            return false;
        }
    }

    return true;
}



function resultReport(marks) {
    if (!Array.isArray(marks)) {
        return "Invalid";
    }

    let total = 0;
    for (let i = 0; i < marks.length; i++) {
        const element = marks[i];
        total = total + element;
    }
    if (marks.length === 0) {
        return { finalScore: 0, pass: 0, fail: 0 };
    }
    const average = total / marks.length;
    const intaverage = Math.round(average);
    let passCount = 0;
    let failCount = 0;
    for (let j = 0; j < marks.length; j++) {
        const mark = marks[j];
        if (mark >= 40) {
            passCount = passCount + 1;
        }
        else {
            failCount = failCount + 1;
        }


    }

    return { finalScore: intaverage, pass: passCount, fail: failCount };
}