function totalFine(fare) {
    if (fare <= 0, typeof fare !== "number") {
        return "Invalid";
    }
    else { return fare + fare * .2 + 30; }
}




