// Product values and dates supplied in the visual reference.
window.homeProductReference = {
  draws: {
    virada: {color:'#00a94f',header:'#00a94f',amount:'1.000.000.000,00',short:'1 Bilhão',contest:'3100',day:'Sexta-Feira',date:'01/01/2027',time:'11h00',close:'2026-12-31T20:00:00-03:00',price:'6,00'},
    mega: {color:'#00a94f',header:'#00a94f',amount:'46.000.000,00',short:'46 Milhões',contest:'3081',day:'Quarta-Feira',date:'04/11/2026',close:'2026-11-04T20:00:00-03:00',price:'6,00'},
    facil: {color:'#92278f',amount:'2.000.000,00',short:'2 Milhões',contest:'3821',day:'Quarta-Feira',date:'04/11/2026',time:'21h00',close:'2026-11-04T20:00:00-03:00',price:'3,50'},
    quina: {color:'#32318e',amount:'10.600.000,00',short:'10,6 Milhões',contest:'7158',day:'Terça-Feira',date:'03/11/2026',close:'2026-11-03T20:00:00-03:00',price:'3,00'},
    milionaria: {color:'#2b327d',amount:'111.000.000,00',short:'111 Milhões',contest:'404',day:'Quarta-Feira',date:'04/11/2026',close:'2026-11-04T20:00:00-03:00',price:'6,00'},
    mania: {color:'#ed7900',amount:'2.200.000,00',short:'2,2 Milhões',contest:'2995',day:'Quarta-Feira',date:'04/11/2026',close:'2026-11-04T20:00:00-03:00',price:'3,00',pool:false},
    timemania: {color:'#00863d',header:'#fff200',button:'#fff200',amount:'24.500.000,00',short:'24,5 Milhões',contest:'2463',day:'Terça-Feira',date:'03/11/2026',close:'2026-11-03T20:00:00-03:00',price:'3,50'},
    dupla: {color:'#af2942',amount:'11.000.000,00',short:'11 Milhões',contest:'3028',day:'Quarta-Feira',date:'04/11/2026',close:'2026-11-04T20:00:00-03:00',price:'3,00'},
    loteca: {color:'#fa1829',amount:'1.000.000,00',short:'1 Milhão',contest:'1280',day:'Quarta-Feira',date:'04/11/2026',time:'16h00',label:'Apuração',close:'2026-11-04T15:00:00-03:00',price:'4,00'},
    dia: {color:'#ad9718',header:'#e8c41e',amount:'1.700.000,00',short:'1,7 Milhão',contest:'1338',day:'Terça-Feira',date:'03/11/2026',close:'2026-11-03T20:00:00-03:00',price:'2,50'},
    super: {color:'#00863d',header:'#bddb29',button:'#85a332',amount:'100.000,00',short:'100 Mil',contest:'918',day:'Quarta-Feira',date:'04/11/2026',close:'2026-11-04T20:00:00-03:00',price:'3,00'}
  },
  countdown(close) {
    const minutes = Math.ceil((Date.parse(close) - Date.now()) / 60000);
    if (minutes <= 0) return 'Exemplo encerrado<br>sem valor financeiro';
    const days = Math.floor(minutes / 1440);
    if (days > 1) return `Exemplo termina em ${days} dias`;
    const hours = Math.floor(minutes / 60), remaining = minutes % 60;
    const text = hours ? `${hours} ${hours === 1 ? 'hora' : 'horas'} e ${remaining} minutos` : `${remaining} ${remaining === 1 ? 'minuto' : 'minutos'}`;
    return `Exemplo termina em<br>${text}`;
  }
};
setInterval(() => {
  document.querySelectorAll('[data-product-close]').forEach(node => {
    node.innerHTML = window.homeProductReference.countdown(node.dataset.productClose);
  });
}, 60000);
