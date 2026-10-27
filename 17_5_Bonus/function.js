function hello() {
    console.log('Hello, World!');
}

// hello();// ফাংকশন কল করা হচ্ছে
// ফাংশনটি "Hello, World!" মুদ্রণ করবে

function moneybag() {
    var money = 1350000;
    console.log('I have ' + money + ' taka');
}

// moneybag();

function jogkorarmachine(input1, input2) {
    let sum = input1 + input2;
    console.log('The sum is = ' + sum);
    return sum;
}

jogkorarmachine(-30, 50);
// jogkorarmachine(1334546453, 35647463734);

const result = jogkorarmachine(-30, 50);
console.log(result);