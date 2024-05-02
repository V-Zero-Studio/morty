const updateLabel = (level) => {
    console.log("updating label")
    var labels = [
        "Not confident at all",
        "Slightly confident",
        "Moderately confident",
        "Very confident",
        "Extremely confident"
    ];
    document.getElementById("label").innerHTML = labels[level - 1];
    
    // Update dot appearance
    var dots = document.getElementsByClassName("dot");
    for (var i = 0; i < dots.length; i++) {
        if (i < level) {
            dots[i].classList.add("selected");
        } else {
            dots[i].classList.remove("selected");
        }
    }
}