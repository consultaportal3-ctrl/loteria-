// Product values and dates supplied in the visual reference.
window.homeProductReference = {
  draws: {
    virada: {"color":"#00a94f","header":"#00a94f","amount":"1.000.000.000,00","short":"1 Bilhão","contest":"3100","day":"Sexta-Feira","date":"01/01/2027","time":"11h00","close":"2026-12-31T20:00:00-03:00","price":"6,00"},
    mega: {"color":"#00a94f","header":"#00a94f","amount":"20.000.000,00","short":"20 Milhões","contest":"3085","day":"Quinta-Feira","date":"12/11/2026","close":"2026-11-12T20:00:00-03:00","price":"6,00"},
    facil: {"color":"#92278f","amount":"2.000.000,00","short":"2 Milhões","contest":"3827","day":"Quarta-Feira","date":"11/11/2026","time":"21h00","close":"2026-11-11T20:00:00-03:00","price":"3,50"},
    quina: {"color":"#32318e","amount":"9.000.000,00","short":"9 Milhões","contest":"7165","day":"Quarta-Feira","date":"11/11/2026","close":"2026-11-11T20:00:00-03:00","price":"3,00"},
    milionaria: {"color":"#2b327d","amount":"113.000.000,00","short":"113 Milhões","contest":"406","day":"Quarta-Feira","date":"11/11/2026","close":"2026-11-11T20:00:00-03:00","price":"6,00"},
    mania: {"color":"#ed7900","amount":"4.800.000,00","short":"4,8 Milhões","contest":"2998","day":"Quarta-Feira","date":"11/11/2026","close":"2026-11-11T20:00:00-03:00","price":"3,00","pool":false},
    timemania: {"color":"#00863d","header":"#fff200","button":"#fff200","amount":"27.000.000,00","short":"27 Milhões","contest":"2467","day":"Quinta-Feira","date":"12/11/2026","close":"2026-11-12T20:00:00-03:00","price":"3,50"},
    dupla: {"color":"#af2942","amount":"12.200.000,00","short":"12,2 Milhões","contest":"3031","day":"Quarta-Feira","date":"11/11/2026","close":"2026-11-11T20:00:00-03:00","price":"3,00"},
    loteca: {"color":"#fa1829","amount":"500.000,00","short":"500 Mil","contest":"1282","day":"Quinta-Feira","date":"12/11/2026","time":"13h00","label":"Apuração","close":"2026-11-12T13:00:00-03:00","price":"4,00"},
    dia: {"color":"#ad9718","header":"#e8c41e","amount":"100.000,00","short":"100 Mil","contest":"1345","day":"Quarta-Feira","date":"11/11/2026","close":"2026-11-11T20:00:00-03:00","price":"2,50"},
    super: {"color":"#00863d","header":"#bddb29","button":"#85a332","amount":"300.000,00","short":"300 Mil","contest":"921","day":"Quarta-Feira","date":"11/11/2026","close":"2026-11-11T20:00:00-03:00","price":"3,00"}
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
