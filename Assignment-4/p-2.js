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

