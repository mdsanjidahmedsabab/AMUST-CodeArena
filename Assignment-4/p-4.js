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


