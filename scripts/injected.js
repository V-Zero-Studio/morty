function sayHello(name) {
    console.log(`Hello, ${name}!`);
}

MORTY.sayHello = sayHello; // Attach it to the window object.
