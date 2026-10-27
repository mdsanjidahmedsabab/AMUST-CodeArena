const numbers = [6, 1, 8, 2, 3, 5];
//console.log(numbers);
numbers.sort();
// console.log(numbers);

const friends = ['sakib', 'rakib', 'akib', 'nokib', 'bakib', 'aaabul'];
// console.log(friends);
friends.sort();
console.log(friends);

const numbers2 = [1, 5, 100, 15, 12, 8, 2, 28];
console.log(numbers2);
numbers2.sort();
console.log(numbers2);

//asending
const sorted_numbers = numbers2.sort(function (a, b) { return a - b });
console.log(sorted_numbers);
//descending
const sorted_numbers_desc = numbers2.sort(function (a, b) { return b - a });
console.log(sorted_numbers_desc);