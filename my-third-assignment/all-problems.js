/** Problem -01 ( Divide the Asset ) */
var area = 800;
//write your code here

var eachWillGet = area / 2;
console.log(eachWillGet);

/** Problem -02 ( Cycle or Laptop ) */
var money = 10000;
//write your code here



if (money >= 25000) {
    console.log("Laptop");
}
else if (money >= 10000) {
    console.log("Cycle");
}
else {
    console.log("Chocolate");
}

/** Problem -03 ( Medicine Planner ) */
var lastDay = 11;
//write your code here

for (var i = 1; i <= lastDay; i++) {
    if (i % 3 == 0) {
        console.log(i + ' - medicine')
    }
    else {
        console.log(i + ' - rest')
    }
}

/** Problem 04 - (Delete / Store) */
var fileName = "pdfData.jpg";
//write your code here

if (fileName.startsWith("#")) {
    console.log("Store");
}
else if (fileName.endsWith(".jpg") || fileName.endsWith(".docx")) {
    console.log("Store");
}
else {
    console.log("Delete");
}

/** Problem 05 - ( PH Email Generator )  */
var student = { name: "jhankar", roll: 1014, department: "cse" };
//write your code here

var email = student.name + student.roll + "." + student.department + "@ph.ac.bd";
console.log(email);

/** Problem 06 :  (Current Salary )  */
var experience = 30;
var startingSalary = 45000;
//write your code here

for (var num = 1; num <= experience; num++) {
    startingSalary = startingSalary + (startingSalary * 0.05);
}

var currentSalary = startingSalary;
console.log(currentSalary.toFixed(2));