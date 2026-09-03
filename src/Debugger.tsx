import React, { useEffect } from 'react';
export default function Debugger() {
  useEffect(() => {
    setTimeout(() => {
      const el = document.querySelector('div#root:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(2)');
      if (el) {
        console.log("DEBUGGER FOUND ELEMENT:", el.className, el.id, el.tagName);
      } else {
        console.log("DEBUGGER NOT FOUND");
      }
    }, 2000);
  }, []);
  return null;
}
