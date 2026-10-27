function sum(num1 = 0, num2 = 0) {
    //const total = num1 + num2;
    // console.log(total);
    // console.log(num1, num2, total);
}

sum(5); // NaN because num2 is undefined
sum();
//NaN --> Not a number

sum(5, 5, 5); // 10

function multiply(a = 1, b = 1) {
    const total = a * b;
    //console.log(total);
    // console.log(a, b, total);
}
multiply(5); // 5
multiply(); // 1    
multiply(5, 5, 5); // 25
multiply(4, 5); // 20

function fullName(first = '', last = '') {
    const name = first + ' ' + last;
    console.log(name);
}

fullName('Jannatul', 'Ferdous'); // Jannatul Ferdous
fullName('Jannatul'); // Jannatul 
fullName(); //  
/*
** Default Parameter Values(if you want)

add, substract --> 0
multyply --> 1
divide --> 1
string --> ''
array --> []
object --> {}

*/