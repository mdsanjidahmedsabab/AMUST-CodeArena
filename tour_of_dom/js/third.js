console.log('third file');

// get the parent
const thirdList = document.getElementById('third-list');

// create new child
const li = document.createElement('li');
li.innerText = 'New Item Added';

// append child to parent
thirdList.appendChild(li);