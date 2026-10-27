const age =18;
// simple ternary
age >=18 ? console.log('You can vote') : console.log('You cannot vote');
// 
isLeader =false;
let price = 100;
price=isLeader===true?0:price+100
console.log(price);

// OPTIONAL :semi advanced ternary

if(isLeader===true){
      if(price>100){
        price=price/2;
      }
      else{
        price=0;
      }
      else{
        price=price+100;
      }
        
      
}

// Feel free to ignore this part
// advanced ternary

price = isLeader===true ?
price>100?
price/2:
0 :
 price + 100;