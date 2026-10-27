/** Problem 06 :  (Current Salary )  */
var experience = 30;
var startingSalary = 45000;
//write your code here

for (var num = 1; num <= experience; num++) {
    startingSalary = startingSalary + (startingSalary * 0.05);
}

var currentSalary = startingSalary;
console.log(currentSalary.toFixed(2));