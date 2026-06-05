// ==========================================
// DATOS DE UNIDADES/SERVICIOS
// ==========================================
const unidades = [
  {
    id: 1,
    nombre: 'Servicio Premium',
    descripcion: 'Acceso completo a todas las funcionalidades',
    precio: '$99.99/mes',
    estado: 'active'
  },
  {
    id: 2,
    nombre: 'Servicio Estándar',
    descripcion: 'Plan básico con funcionalidades esenciales',
    precio: '$49.99/mes',
    estado: 'active'
  },
  {
    id: 3,
    nombre: 'Servicio Gratuito',
    descripcion: 'Plan de prueba con funciones limitadas',
    precio: 'Gratis',
    estado: 'active'
  },
  {
    id: 4,
    nombre: 'Soporte Prioritario',
    descripcion: 'Atención al cliente 24/7',
    precio: '$29.99/mes',
    estado: 'active'
  },
  {
    id: 5,
    nombre: 'Integración API',
    descripcion: 'Conecta con tus aplicaciones favoritas',
    precio: '$49.99/mes',
    estado: 'inactive'
  },
  {
    id: 6,
    nombre: 'Almacenamiento Extra',
    descripcion: '1TB de almacenamiento adicional',
    precio: '$19.99/mes',
    estado: 'active'
  }
];

// ==========================================
// MENÚ HAMBURGUESA
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  if (hamburger) {
    hamburger.addEventListener('click', function() {
      navMenu.classList.toggle('active');
      hamburger.classList.toggle('active');
    });

    // Cerrar menú al hacer click en un enlace
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', function() {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
      });
    });
  }
});

// ==========================================
// CARGAR UNIDADES EN LA PÁGINA
// ==========================================
function cargarUnidades(unidadesAMostrar = unidades) {
  const unidadesList = document.getElementById('unidadesList');
  
  if (!unidadesList) return;

  unidadesList.innerHTML = '';

  if (unidadesAMostrar.length === 0) {
    unidadesList.innerHTML = '<p class="no-results">No se encontraron unidades.</p>';
    return;
  }

  unidadesAMostrar.forEach(unidad => {
    const card = document.createElement('div');
    card.className = 'unidad-card';
    card.innerHTML = `
      <h3>${unidad.nombre}</h3>
      <p class="description">${unidad.descripcion}</p>
      <p class="price">${unidad.precio}</p>
      <span class="status ${unidad.estado}">
        ${unidad.estado === 'active' ? '✓ Disponible' : '✗ No disponible'}
      </span>
    `;
    unidadesList.appendChild(card);

    // Agregar interacción al hacer click
    card.addEventListener('click', function() {
      mostrarDetalleUnidad(unidad);
    });
  });
}

// ==========================================
// MOSTRAR DETALLES DE UNIDAD
// ==========================================
function mostrarDetalleUnidad(unidad) {
  console.log('Unidad seleccionada:', unidad);
  alert(`
    Unidad: ${unidad.nombre}
    Descripción: ${unidad.descripcion}
    Precio: ${unidad.precio}
    Estado: ${unidad.estado === 'active' ? 'Disponible' : 'No disponible'}
  `);
}

// ==========================================
// BUSCADOR DE UNIDADES
// ==========================================
function inicializarBuscador() {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  if (searchInput && searchBtn) {
    // Buscar al hacer click en el botón
    searchBtn.addEventListener('click', function() {
      realizarBusqueda();
    });

    // Buscar al presionar Enter
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        realizarBusqueda();
      }
    });

    // Buscar mientras escribes (en tiempo real)
    searchInput.addEventListener('input', function() {
      realizarBusqueda();
    });
  }
}

function realizarBusqueda() {
  const searchInput = document.getElementById('searchInput');
  const termino = searchInput.value.toLowerCase().trim();

  let resultados;
  
  if (termino === '') {
    resultados = unidades;
  } else {
    resultados = unidades.filter(unidad => 
      unidad.nombre.toLowerCase().includes(termino) ||
      unidad.descripcion.toLowerCase().includes(termino)
    );
  }

  cargarUnidades(resultados);
}

// ==========================================
// VALIDACIÓN DE FORMULARIO
// ==========================================
function inicializarFormulario() {
  const form = document.getElementById('contactForm');
  const formMessage = document.getElementById('formMessage');

  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();

      // Obtener valores del formulario
      const nombre = document.getElementById('nombre').value.trim();
      const email = document.getElementById('email').value.trim();
      const mensaje = document.getElementById('mensaje').value.trim();

      // Validaciones básicas
      if (!nombre || !email || !mensaje) {
        mostrarMensajeFormulario('Por favor, completa todos los campos.', 'error');
        return;
      }

      // Validar email
      if (!validarEmail(email)) {
        mostrarMensajeFormulario('Por favor, ingresa un email válido.', 'error');
        return;
      }

      // Validar longitud mínima
      if (nombre.length < 3) {
        mostrarMensajeFormulario('El nombre debe tener al menos 3 caracteres.', 'error');
        return;
      }

      if (mensaje.length < 10) {
        mostrarMensajeFormulario('El mensaje debe tener al menos 10 caracteres.', 'error');
        return;
      }

      // Si todo es válido
      console.log('Datos del formulario:', { nombre, email, mensaje });
      mostrarMensajeFormulario('¡Consulta enviada correctamente! Nos pondremos en contacto pronto.', 'success');
      
      // Limpiar formulario
      form.reset();

      // Limpiar mensaje después de 5 segundos
      setTimeout(() => {
        formMessage.innerHTML = '';
        formMessage.className = 'form-message';
      }, 5000);
    });
  }
}

function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function mostrarMensajeFormulario(mensaje, tipo) {
  const formMessage = document.getElementById('formMessage');
  formMessage.textContent = mensaje;
  formMessage.className = `form-message ${tipo}`;
}

// ==========================================
// INICIALIZACIÓN GENERAL
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
  // Cargar unidades si estamos en la página de unidades
  const unidadesList = document.getElementById('unidadesList');
  if (unidadesList) {
    cargarUnidades();
    inicializarBuscador();
    inicializarFormulario();
  }

  console.log('App iniciada correctamente');
});

// ==========================================
// FUNCIONES ADICIONALES
// ==========================================

// Función para agregar nuevas unidades (para futuras extensiones)
function agregarUnidad(nombre, descripcion, precio, estado = 'active') {
  const nuevaUnidad = {
    id: unidades.length + 1,
    nombre,
    descripcion,
    precio,
    estado
  };
  unidades.push(nuevaUnidad);
  cargarUnidades();
}

// Función para filtrar por estado
function filtrarPorEstado(estado) {
  const unidadesFiltradas = unidades.filter(u => u.estado === estado);
  cargarUnidades(unidadesFiltradas);
}

// Exportar funciones si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { unidades, cargarUnidades, agregarUnidad, filtrarPorEstado };
}
