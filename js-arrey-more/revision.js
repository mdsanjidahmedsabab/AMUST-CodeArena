/**
 * 1. const--> value not going to change
 * 2. let--> value can change
 * 3. var--> value can change, but not recommended to use
 */

const price = 500;
// console.log(price);
const name = 'Maruf';// string
const isPoor = false;//boolean
const friends = ['Elon', 'Bill', 'Steve'];
const student = { class: 9, name: 'Maruf', age: 16, address: 'Rajshahi' };//object

// condition
if (price > 1000) {
    console.log('too cheap');
}
else if (price > 500) {
    console.log('just ok');
}
else {
    console.log('too expensive');
}

// loop
let pushUp = 0;
while (pushUp < 10) {
    console.log('push up', pushUp);
    // pushUp = pushUp + 1;
    // pushUp += 1;
    pushUp++;
}

// for loop
for (let i = 0; i < 10; i++) {
    console.log('push up', i);
}










