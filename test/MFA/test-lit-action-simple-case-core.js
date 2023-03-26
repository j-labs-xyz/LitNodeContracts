const action = require('./lit-action-simple-case-core');

function start() {
    return action.go();
}

(async() => {
console.log('before start');

await start();

console.log('after start');
})();