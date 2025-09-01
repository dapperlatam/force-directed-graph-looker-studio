// Importar D3.js
const dscc = require('@google/dscc');
const d3 = require('d3');

// Variables globales
let svg, simulation, link, node, nodeLabels;
let width, height;

// Función principal que maneja los datos de Looker Studio
const drawViz = (data) => {
  // Obtener dimensiones del contenedor
  const element = document.getElementById('myViz');
  width = element.offsetWidth;
  height = element.offsetHeight;

  // Limpiar visualización anterior
  d3.select('#myViz').selectAll('*').remove();

  // Procesar datos
  const processedData = processData(data);
  
  // Crear SVG
  createSVG();
  
  // Crear simulación de fuerzas
  createSimulation(processedData);
  
  // Renderizar elementos
  renderVisualization(processedData, data.style);
};

// Procesar datos de Looker Studio
const processData = (data) => {
  const rows = data.tables.DEFAULT;
  const nodes = new Map();
  const links = [];

  // Extraer nodos y enlaces de los datos
  rows.forEach(row => {
    const source = row.sourceNode[0];
    const target = row.targetNode[0];
    const edgeWeight = row.edgeWeight[0] || 1;
    const edgeColorWeight = row.edgeColorWeight[0] || 1;

    // Agregar nodos únicos
    if (!nodes.has(source)) {
      nodes.set(source, {
        id: source,
        name: source,
        type: 'source'
      });
    }
    
    if (!nodes.has(target)) {
      nodes.set(target, {
        id: target,
        name: target,
        type: 'target'
      });
    }

    // Agregar enlace
    links.push({
      source: source,
      target: target,
      weight: edgeWeight,
      colorWeight: edgeColorWeight
    });
  });

  return {
    nodes: Array.from(nodes.values()),
    links: links
  };
};

// Crear elemento SVG
const createSVG = () => {
  svg = d3.select('#myViz')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Agregar definiciones para gradientes y patrones
  const defs = svg.append('defs');
  
  // Gradiente para enlaces basado en peso de color
  const gradient = defs.append('linearGradient')
    .attr('id', 'linkGradient');
    
  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#ccc');
    
  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#666');
};

// Crear simulación de fuerzas
const createSimulation = (data) => {
  simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(25));
};

// Renderizar la visualización
const renderVisualization = (data, style) => {
  // Configuración de estilos
  const sourceNodeColor = style.sourceNodeColor?.color || '#4285F4';
  const targetNodeColor = style.targetNodeColor?.color || '#EA4335';
  const sourceNodeWeight = style.sourceNodeWeight || 10;
  const targetNodeWeight = style.targetNodeWeight || 10;
  const sourceNodeLabelColor = style.sourceNodeLabelColor?.color || '#000000';
  const targetNodeLabelColor = style.targetNodeLabelColor?.color || '#000000';

  // Crear escala para el grosor de enlaces basado en peso
  const linkWidthScale = d3.scaleLinear()
    .domain(d3.extent(data.links, d => d.weight))
    .range([1, 8]);

  // Crear escala de color para enlaces basado en colorWeight
  const linkColorScale = d3.scaleSequential(d3.interpolateViridis)
    .domain(d3.extent(data.links, d => d.colorWeight));

  // Renderizar enlaces
  link = svg.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(data.links)
    .enter().append('line')
    .attr('stroke', d => linkColorScale(d.colorWeight))
    .attr('stroke-width', d => linkWidthScale(d.weight))
    .attr('stroke-opacity', 0.6);

  // Renderizar nodos
  node = svg.append('g')
    .attr('class', 'nodes')
    .selectAll('circle')
    .data(data.nodes)
    .enter().append('circle')
    .attr('r', d => d.type === 'source' ? sourceNodeWeight : targetNodeWeight)
    .attr('fill', d => d.type === 'source' ? sourceNodeColor : targetNodeColor)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', function(event, d) {
      // Manejar interacciones de filtro
      handleNodeClick(d);
    });

  // Agregar etiquetas a los nodos
  nodeLabels = svg.append('g')
    .attr('class', 'node-labels')
    .selectAll('text')
    .data(data.nodes)
    .enter().append('text')
    .text(d => d.name)
    .attr('font-size', '12px')
    .attr('text-anchor', 'middle')
    .attr('dy', '.35em')
    .attr('fill', d => d.type === 'source' ? sourceNodeLabelColor : targetNodeLabelColor)
    .style('pointer-events', 'none');

  // Iniciar simulación
  simulation.on('tick', ticked);
};

// Función para actualizar posiciones en cada tick de la simulación
const ticked = () => {
  link
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  node
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);

  nodeLabels
    .attr('x', d => d.x)
    .attr('y', d => d.y);
};

// Funciones de arrastre
const dragstarted = (event, d) => {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
};

const dragged = (event, d) => {
  d.fx = event.x;
  d.fy = event.y;
};

const dragended = (event, d) => {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
};

// Manejar clicks en nodos para filtros
const handleNodeClick = (nodeData) => {
  // Enviar evento de filtro a Looker Studio
  dscc.sendInteraction('FILTER', {
    concepts: ['sourceNode', 'targetNode'],
    values: [[nodeData.name], [nodeData.name]]
  });
};

// Función para redimensionar
const resize = () => {
  const element = document.getElementById('myViz');
  width = element.offsetWidth;
  height = element.offsetHeight;
  
  if (svg) {
    svg.attr('width', width).attr('height', height);
    
    if (simulation) {
      simulation.force('center', d3.forceCenter(width / 2, height / 2));
      simulation.alpha(0.3).restart();
    }
  }
};

// Escuchar cambios de tamaño
window.addEventListener('resize', resize);

// Suscribirse a los datos de Looker Studio
dscc.subscribeToData(drawViz, {transform: dscc.objectTransform});

// Crear el contenedor inicial
document.body.innerHTML = '<div id="myViz"></div>';