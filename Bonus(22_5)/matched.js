const products = [
    { id: 1, name: 'Laptop', price: 999.99 },
    { id: 2, name: 'laptop gjughn', price: 499.99 },
    { id: 3, name: 'Tablet and laptop', price: 299.99 },
    { id: 4, name: 'Monitor and laptop', price: 199.99 },
    { id: 5, name: 'Keyboard', price: 49.99 }
]

function matchedProducts(products, searchText) {
    const matched = [];
    for (const product of products) {
        if (product.name.toLowerCase().includes(searchText.toLowerCase())) {
            matched.push(product.name);
        };
    }
    return matched;
}

const result = matchedProducts(products, 'laptop');
console.log(result);