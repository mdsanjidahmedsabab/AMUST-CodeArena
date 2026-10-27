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



