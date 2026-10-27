// 1. psrent node
const mainContainer = document.getElementById('main-container');

// 2. create child node
const placesSection = document.createElement('section');

// create h1 element
const h1 = document.createElement('h1');
h1.innerText = 'Places I want to Visit in Bangladesh';
placesSection.appendChild(h1);

const ul = document.createElement('ul');

const li1 = document.createElement('li');
li1.innerText = 'Coxs Bazar';
ul.appendChild(li1);

const li2 = document.createElement('li');
li2.innerText = 'Sajek Valley';
ul.appendChild(li2);


placesSection.appendChild(ul);


// 3. append placeSection  to mainContainer
mainContainer.appendChild(placesSection);


// easier to creat HTML
const booksSection = document.createElement('section');

booksSection.innerHTML = `
<h1> Books I want to Read</h1>
<ul>
    <li>Physics</li>
    <li>Chemistry</li>
    <li>Mathematics</li>
    <li>Biology</li>
</ul>
`
mainContainer.appendChild(booksSection);