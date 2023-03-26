const go = async () => {
    const now = new Date();
    const minute = now.getMinutes();
    
    let returnValue = false;
    if (minute % 2 == 0) {
        returnValue = true;
    } else {
        returnValue = false;
    }  
    
    console.log('now is', now);
    console.log('minute is', minute);
    console.log('return value is', returnValue);

    return returnValue;
};

module.exports = {
    go,
};
