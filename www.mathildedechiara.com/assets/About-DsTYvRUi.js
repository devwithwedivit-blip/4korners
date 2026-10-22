import{r as i,j as a}from"./vendor-react-BfwrijtY.js";
const $=()=>{
  i.useEffect(()=>{
    try { sessionStorage.setItem("introSeen", "1"); } catch(e) {}
  },[]);
  return a.jsx("iframe",{
    src:"/about.html",
    title:"About · 4 Korners Design Studio",
    style:{
      position:"fixed",
      top:0,
      left:0,
      width:"100vw",
      height:"100vh",
      border:"none",
      margin:0,
      padding:0,
      zIndex:99999,
      background:"#F8F7F4"
    }
  });
};
export{$ as default};
