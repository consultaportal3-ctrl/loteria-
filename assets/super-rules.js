(() => {
  const total = columns => columns.reduce((sum,column) => sum + column.length,0);
  const valid = (columns,repeats=1) => {
    if(!Array.isArray(columns) || columns.length!==7 || ![1,3,6,9,12].includes(repeats))return false;
    if(!Array.from(columns).every(column => Array.isArray(column) && column.length>=1 && column.length<=3 && new Set(column).size===column.length && Array.from(column).every(n=>Number.isInteger(n)&&n>=0&&n<=9)))return false;
    const count=total(columns);
    return count<=14 ? columns.every(column=>column.length<=2) : columns.every(column=>column.length>=2);
  };
  const price = (columns,repeats=1) => 3 * columns.reduce((product,column)=>product*column.length,1) * repeats;
  const targetPrice = (count,repeats=1) => 3 * (count<=14 ? 2**(count-7) : 2**(21-count)*3**(count-14)) * repeats;
  const labels = columns => columns.map((column,index)=>`${index+1}ª: ${column.join(' / ')}`);
  const renderColumns = (container,columns) => {
    container.replaceChildren();
    columns.forEach((numbers,index)=>{
      const column=document.createElement('span');column.className='recent-super-column';
      column.setAttribute('aria-label',`Coluna ${index+1}: ${numbers.join(' / ')}`);
      const heading=document.createElement('b');heading.textContent=index+1;heading.setAttribute('aria-hidden','true');column.append(heading);
      numbers.forEach(number=>{const digit=document.createElement('span');digit.textContent=number;digit.setAttribute('aria-hidden','true');column.append(digit);});
      container.append(column);
    });
  };
  window.superSeteRules={total,valid,price,targetPrice,labels,renderColumns};
})();
