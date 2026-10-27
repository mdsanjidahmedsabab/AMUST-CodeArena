// const poem = 'amm pata jorajora'
// marbo chabuk chorbo ghora'

// const poem = 'amm pata jora jora \n' + 'marbo chabuk chorbo ghora \n' + 'ore bubu sore dara'

//backtick`````````````````````````````````````````````````````````````````
const poem = `amm pata jorajora
marbo chabuk chorbo ghora
ore bubu sore dara`;

//console.log(poem);

function sum(a, b) {
    const result = a + b;
    //const output = 'sum of ' + a + ' and ' + b + ' is ' + result;
    const output = `sum of ${a} and ${b} is = ${result}`;
    //console.log(output);
}
sum(12, 13);

const price = 100;
const discountedprice = `Discounted price of ${price} after 10% discount is = ${price * 0.9}`;
console.log(discountedprice);