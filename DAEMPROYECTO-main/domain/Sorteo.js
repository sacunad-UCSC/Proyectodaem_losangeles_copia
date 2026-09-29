const { ESTADOS_CUMPLIMIENTO } = require("../constants/catalogos");

// ============================================================
// Algoritmo de sorteo y emparejamiento de contrincantes.
// Nivela las llaves usando el "valor de cumplimiento" de cada
// establecimiento en la actividad (cumple > regular > no_cumple).
// ============================================================

class Sorteo {
  constructor(participantes = [], grupos = ["Llave"]) {
    this.participantes = participantes.map((p) => ({
      establecimiento: p.establecimiento,
      division: p.division,
      estado: p.estado || ESTADOS_CUMPLIMIENTO.NO_CUMPLE.nombre,
      valor: p.valor ?? Sorteo.valorDe(p.estado),
    }));
    this.grupos = grupos.length ? grupos : ["Llave"];
  }

  static valorDe(estado) {
    const item = Object.values(ESTADOS_CUMPLIMIENTO).find((e) => e.nombre === estado);
    return item ? item.valor : ESTADOS_CUMPLIMIENTO.NO_CUMPLE.valor;
  }

  // Cantidad de rondas de un bracket de eliminacion directa.
  static nivelesNecesarios(cantidadEquipos) {
    if (cantidadEquipos <= 1) return 1;
    return Math.ceil(Math.log2(cantidadEquipos));
  }

  static mezclar(lista) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  // Reparte participantes en grupos equilibrados (por cantidad y valor).
  static repartirEnGrupos(participantes, grupos) {
    const ordenados = [...participantes].sort((a, b) => b.valor - a.valor);
    const G = grupos.length || 1;
    const asignados = grupos.map(() => []);
    ordenados.forEach((p, idx) => {
      asignados[idx % G].push(p);
    });
    return grupos.map((nombre, i) => ({ nombre, participantes: asignados[i] }));
  }

  // Genera todos contra todos (round-robin) usando el metodo del circulo.
  static crucesRoundRobin(participantes) {
    const n = participantes.length;
    if (n < 2) return [];
    const arr = n % 2 === 1 ? [...participantes, null] : [...participantes];
    const rondas = arr.length - 1;
    const cruces = [];
    for (let r = 0; r < rondas; r++) {
      for (let i = 0; i < arr.length / 2; i++) {
        const a = arr[i];
        const b = arr[arr.length - 1 - i];
        if (a && b) cruces.push([a, b]);
      }
      arr.splice(1, 0, arr.pop());
    }
    return cruces;
  }

  // Empareja de forma balanceada: el "mas fuerte" con el "mas debil"
  // (segun valor de cumplimiento), introduciendo aleatoriedad dentro
  // de cada nivel para que el sorteo no sea predecible.
  construirLlaves() {
    if (this.participantes.length < 2) {
      throw new Error("Se necesitan al menos 2 establecimientos para realizar el sorteo");
    }

    const ordenados = [...this.participantes].sort((a, b) => a.valor - b.valor);
    const llaves = [];
    let i = 0;
    let j = ordenados.length - 1;

    while (i <= j) {
      if (i === j) {
        // Numero impar: bye (pasa directo / queda libre).
        llaves.push({
          equipos: [ordenados[i].establecimiento, null],
          division: ordenados[i].division,
          estadoEquipoA: ordenados[i].estado,
          bye: true,
        });
      } else {
        llaves.push({
          equipos: [ordenados[i].establecimiento, ordenados[j].establecimiento],
          division: ordenados[i].division,
          estadoEquipoA: ordenados[i].estado,
          estadoEquipoB: ordenados[j].estado,
        });
      }
      i += 1;
      j -= 1;
    }

    // Asigna grupos en round-robin para repartir la carga.
    const indiceGrupo = (idx) => this.grupos[idx % this.grupos.length];
    return Sorteo.mezclar(llaves).map((llave, idx) => ({
      ...llave,
      grupo: indiceGrupo(idx),
    }));
  }
}

module.exports = Sorteo;