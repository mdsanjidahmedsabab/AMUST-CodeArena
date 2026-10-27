const age=17;
const price=500;
if (age<=12) {
    console.log('You can eat for free');
}
else if (age>=60){
    // 50% discount
    const discount =price * 50/100;
    const payAmount = price - discount;
    console.log(payAmount);
}
else if (age>=50){
    // 30% discount
    const discount = price * 30/100;
    const payAmount = price - discount;
    console.log(payAmount);
}
else{
    console.log(price);
}