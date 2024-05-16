
export function print(){
  return window.print();
}


// Function to handle printing
function customPrint() {
  // Your custom printing logic here
  window.print();
}



// export function createPrintButton(){
//   const doc = document.querySelector(".document")
//   const button = document.createElement("button")
//   button.innerText = "Print"
//   button.addEventListener('click', () => window.print());
//   doc.appendChild(button)
//   console.log("here")
// }
