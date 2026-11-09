// Product values and dates supplied in the visual reference.
window.homeProductReference = {
  draws: {
    virada: {color:'#00a94f',header:'#00a94f',amount:'1.000.000.000,00',short:'1 Bilhão',contest:'3100',day:'Sexta-Feira',date:'01/01/2027',time:'11h00',close:'2026-12-31T20:00:00-03:00',price:'6,00'},
    mega: {color:'#00a94f',header:'#00a94f',amount:'3.500.000,00',short:'3,5 Milhões',contest:'3084',day:'Terça-Feira',date:'10/11/2026',close:'2026-11-10T20:00:00-03:00',price:'6,00'},
    facil: {color:'#92278f',amount:'2.000.000,00',short:'2 Milhões',contest:'3825',day:'Segunda-Feira',date:'09/11/2026',time:'21h00',close:'2026-11-09T20:00:00-03:00',price:'3,50'},
    quina: {color:'#32318e',amount:'3.000.000,00',short:'3 Milhões',contest:'7163',day:'Segunda-Feira',date:'09/11/2026',close:'2026-11-09T20:00:00-03:00',price:'3,00'},
    milionaria: {color:'#2b327d',amount:'113.000.000,00',short:'113 Milhões',contest:'406',day:'Quarta-Feira',date:'11/11/2026',close:'2026-11-11T20:00:00-03:00',price:'6,00'},
    mania: {color:'#ed7900',amount:'4.000.000,00',short:'4 Milhões',contest:'2997',day:'Segunda-Feira',date:'09/11/2026',close:'2026-11-09T20:00:00-03:00',price:'3,00',pool:false},
    timemania: {color:'#00863d',header:'#fff200',button:'#fff200',amount:'26.300.000,00',short:'26,3 Milhões',contest:'2466',day:'Terça-Feira',date:'10/11/2026',close:'2026-11-10T20:00:00-03:00',price:'3,50'},
    dupla: {color:'#af2942',amount:'11.600.000,00',short:'11,6 Milhões',contest:'3030',day:'Segunda-Feira',date:'09/11/2026',close:'2026-11-09T20:00:00-03:00',price:'3,00'},
    loteca: {color:'#fa1829',amount:'500.000,00',short:'500 Mil',contest:'1282',day:'Quinta-Feira',date:'12/11/2026',time:'13h00',label:'Apuração',close:'2026-11-12T13:00:00-03:00',price:'4,00'},
    dia: {color:'#ad9718',header:'#e8c41e',amount:'3.700.000,00',short:'3,7 Milhões',contest:'1343',day:'Segunda-Feira',date:'09/11/2026',close:'2026-11-09T20:00:00-03:00',price:'2,50'},
    super: {color:'#00863d',header:'#bddb29',button:'#85a332',amount:'250.000,00',short:'250 Mil',contest:'920',day:'Segunda-Feira',date:'09/11/2026',close:'2026-11-09T20:00:00-03:00',price:'3,00'}
  },
  countdown(close) {
    const minutes = Math.ceil((Date.parse(close) - Date.now()) / 60000);
    if (minutes <= 0) return 'Apostas encerradas<br>para este concurso';
    const days = Math.floor(minutes / 1440);
    if (days >= 1) return `Apostas se encerram em ${days} ${days === 1 ? 'dia' : 'dias'}`;
    const hours = Math.floor(minutes / 60), remaining = minutes % 60;
    const text = hours ? `${hours} ${hours === 1 ? 'hora' : 'horas'} e ${remaining} minutos` : `${remaining} ${remaining === 1 ? 'minuto' : 'minutos'}`;
    return `Apostas se encerram em<br>${text}`;
  }
};
setInterval(() => {
  document.querySelectorAll('[data-product-close]').forEach(node => {
    node.innerHTML = window.homeProductReference.countdown(node.dataset.productClose);
  });
}, 60000);
