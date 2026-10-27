const salary=25000;
const isBCS= true;
const height=72;
const hasCar=false;
// if(salary>20000){
//     console.log('su----patro')
// }
// else{
//     console.log('onno patro khuji')
// }

// if(salary>20000 && isBCS){
//     console.log('su----patro')
// }
// else{
//     console.log('onno patro khuji')
// }

// if(salary>20000 && isBCS && height>66){
//     console.log('su----patro')
// }
// else{
//     console.log('onno patro khuji')
// }

// if(salary>20000 && height>66){
//     console.log('su----patro')
// }
// else{
//     console.log('onno patro khuji')
// }

if(salary>200000 || isBCS== true || height>71){
    console.log('su----patro')
}
else{
    console.log('onno patro khuji')
}

// COMPLEX COMDITION
if ((salary>20000 && isBCS) || (height>66 && hasCar)) {
    console.log('su----patro')
}
else{
    console.log('onno patro khuji')
}

if ((salary>20000 ||isBCS==true) && (height>66 || hasCar==true)) {
    console.log('su----patro')
}
else{
    console.log('onno patro khuji')
}