// Product values and dates supplied in the visual reference.
window.homeProductReference = {
  draws: {
    virada: {"color":"#00a94f","header":"#00a94f","amount":"1.000.000.000,00","short":"1 Bilhão","contest":"3100","day":"Sexta-Feira","date":"01/01/2027","time":"11h00","close":"2026-12-31T20:00:00-03:00","price":"6,00"},
    mega: {"color":"#00a94f","header":"#00a94f","amount":"27.000.000,00","short":"27 Milhões","contest":"3086","day":"Domingo","date":"15/11/2026","close":"2026-11-15T10:00:00-03:00","price":"6,00","time":"11h00"},
    facil: {"color":"#92278f","amount":"2.000.000,00","short":"2 Milhões","contest":"3829","day":"Sexta-Feira","date":"13/11/2026","time":"21h00","close":"2026-11-13T20:00:00-03:00","price":"3,50"},
    quina: {"color":"#32318e","amount":"11.000.000,00","short":"11 Milhões","contest":"7167","day":"Sexta-Feira","date":"13/11/2026","close":"2026-11-13T20:00:00-03:00","price":"3,00","time":"21h00"},
    milionaria: {"color":"#2b327d","amount":"115.000.000,00","short":"115 Milhões","contest":"407","day":"Sexta-Feira","date":"13/11/2026","close":"2026-11-13T20:00:00-03:00","price":"6,00","time":"21h00"},
    mania: {"color":"#ed7900","amount":"5.700.000,00","short":"5,7 Milhões","contest":"2999","day":"Sexta-Feira","date":"13/11/2026","close":"2026-11-13T20:00:00-03:00","price":"3,00","pool":false,"time":"21h00"},
    timemania: {"color":"#00863d","header":"#fff200","button":"#fff200","amount":"27.500.000,00","short":"27,5 Milhões","contest":"2468","day":"Domingo","date":"15/11/2026","close":"2026-11-15T10:00:00-03:00","price":"3,50","time":"11h00"},
    dupla: {"color":"#af2942","amount":"13.000.000,00","short":"13 Milhões","contest":"3032","day":"Sexta-Feira","date":"13/11/2026","close":"2026-11-13T20:00:00-03:00","price":"3,00","time":"21h00"},
    loteca: {"color":"#fa1829","amount":null,"short":null,"contest":"1283","day":"Segunda-Feira","date":"16/11/2026","time":"15h45","label":"Apuração","close":"2026-11-16T15:45:00-03:00","price":"4,00","pool":false},
    dia: {"color":"#ad9718","header":"#e8c41e","amount":"450.000,00","short":"450 Mil","contest":"1347","day":"Sexta-Feira","date":"13/11/2026","close":"2026-11-13T20:00:00-03:00","price":"2,50","time":"21h00"},
    super: {"color":"#00863d","header":"#bddb29","button":"#85a332","amount":"350.000,00","short":"350 Mil","contest":"922","day":"Sexta-Feira","date":"13/11/2026","close":"2026-11-13T20:00:00-03:00","price":"3,00","time":"21h00"}
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
