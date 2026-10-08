import React, { useState, useEffect } from "react";
import { api, BRL, formatApiError } from "@/lib/api";

const BARBERS = [
  { id: 1, name: "Capoli", specialty: "Corte Clássico & Estilo" },
  { id: 2, name: "Novaes", specialty: "Degradê & Moderno" },
];

const SERVICES = [
  { id: 1, name: "Corte Simples", price: 20.00 },
  { id: 2, name: "Corte Degradê", price: 40.00 },
  { id: 3, name: "Corte Todo na Tesoura", price: 25.00, prefix: "a partir de" },
  { id: 4, name: "Corte Degradê + Tesoura", price: 45.00, prefix: "a partir de" },
  { id: 5, name: "Barba", price: 15.00, prefix: "a partir de" },
  { id: 6, name: "Cavanhaque", price: 15.00, prefix: "a partir de" },
  { id: 7, name: "Pézinho / Acabamento", price: 10.00, prefix: "a partir de" },
  { id: 8, name: "Sobrancelha (avulsa)", price: 10.00 },
  { id: 9, name: "Pigmentação", price: 20.00 },
  { id: 10, name: "Coloração", price: 60.00, prefix: "a partir de" },
  { id: 11, name: "Platinado / Nevou", price: 60.00 },
  { id: 12, name: "Reflexo / Luzes", price: 60.00, prefix: "a partir de" },
];

// Gera horários das 09:00 às 19:00 com intervalos de 40 minutos
const generateTimeSlots = () => {
  const slots = [];
  let startMinutes = 9 * 60; // 09:00
  const endMinutes = 19 * 60; // 19:00
  const interval = 40; // 40 minutos

  while (startMinutes <= endMinutes) {
    const hours = Math.floor(startMinutes / 60);
    const mins = startMinutes % 60;
    const timeString = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    slots.push(timeString);
    startMinutes += interval;
  }
  return slots;
};

const ALL_TIME_SLOTS = generateTimeSlots();

export function BookingWidget({ onAppointmentCreated }) {
  const [selectedBarber, setSelectedBarber] = useState(BARBERS[0].id);
  const [selectedService, setSelectedService] = useState(SERVICES[0].id);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Atualiza os horários ocupados sempre que muda de barbeiro ou de data
  useEffect(() => {
    if (!selectedDate) {
      setBookedSlots([]);
      return;
    }
    const fetchBookedSlots = async () => {
      try {
        const res = await api.get(`/appointments?date=${selectedDate}&barber_id=${selectedBarber}`);
        // Se a API retornar uma lista de agendamentos para este dia/barbeiro
        const appointments = res.data || [];
        const timesOcupados = appointments.map((app) => app.time);
        setBookedSlots(timesOcupados);
      } catch (err) {
        // Fallback local caso a API não tenha endpoint específico
        const allSaved = JSON.parse(localStorage.getItem("studio01_appointments") || "[]");
        const ocupados = allSaved
          .filter((app) => String(app.barber_id) === String(selectedBarber) && app.date === selectedDate)
          .map((app) => app.time);
        setBookedSlots(ocupados);
      }
    };
    fetchBookedSlots();
  }, [selectedDate, selectedBarber]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!selectedDate || !selectedTime || !clientName || !clientPhone) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    // Validação extra de segurança local
    if (bookedSlots.includes(selectedTime)) {
      setError("Este horário já foi reservado. Por favor, escolha outro.");
      return;
    }

    setLoading(true);
    try {
      const barberObj = BARBERS.find((b) => b.id === Number(selectedBarber));
      const serviceObj = SERVICES.find((s) => s.id === Number(selectedService));

      const payload = {
        barber_id: selectedBarber,
        barber_name: barberObj?.name,
        service_id: selectedService,
        service_name: serviceObj?.name,
        price: serviceObj?.price,
        date: selectedDate,
        time: selectedTime,
        client_name: clientName,
        client_phone: clientPhone,
      };

      await api.post("/appointments", payload);

      // Registo local automático no localStorage para sincronizar a agenda instantaneamente
      const existing = JSON.parse(localStorage.getItem("studio01_appointments") || "[]");
      localStorage.setItem("studio01_appointments", JSON.stringify([...existing, payload]));

      // Atualiza os horários ocupados no ecrã
      setBookedSlots([...bookedSlots, selectedTime]);

      setSuccessMessage(`Agendamento confirmado para ${selectedDate} às ${selectedTime}!`);
      setClientName("");
      setClientPhone("");
      setSelectedTime("");
      if (onAppointmentCreated) onAppointmentCreated();
    } catch (err) {
      setError(formatApiError(err?.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">Agenda Automatizada — Studio 01</h2>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
      {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">{successMessage}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Escolha do Barbeiro */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">1. Escolha o Barbeiro</label>
          <div className="grid grid-cols-2 gap-4">
            {BARBERS.map((barber) => (
              <button
                type="button"
                key={barber.id}
                onClick={() => {
                  setSelectedBarber(barber.id);
                  setSelectedTime("");
                }}
                className={`p-4 rounded-lg border text-left transition-all ${
                  selectedBarber === barber.id
                    ? "border-black bg-black text-white"
                    : "border-gray-200 hover:border-gray-400 bg-gray-50"
                }`}
              >
                <div className="font-bold text-lg">{barber.name}</div>
                <div className={`text-xs ${selectedBarber === barber.id ? "text-gray-300" : "text-gray-500"}`}>
                  {barber.specialty}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Escolha do Serviço */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">2. Escolha o Serviço</label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(Number(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black bg-white"
          >
            {SERVICES.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} — {service.prefix ? `${service.prefix} ` : ""}{BRL(service.price)}
              </option>
            ))}
          </select>
        </div>

        {/* Data e Hora Automatizada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">3. Data do Atendimento</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedTime("");
              }}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">4. Horários Disponíveis (40 min)</label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black bg-white"
              required
              disabled={!selectedDate}
            >
              <option value="">{!selectedDate ? "Selecione a data primeiro" : "Selecione um horário livre"}</option>
              {ALL_TIME_SLOTS.map((time) => {
                const isBooked = bookedSlots.includes(time);
                return (
                  <option key={time} value={time} disabled={isBooked} className={isBooked ? "text-gray-400 bg-gray-100" : ""}>
                    {time} {isBooked ? "— (Ocupado)" : "— (Disponível)"}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Dados do Cliente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Seu Nome</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Seu Telefone / WhatsApp</label>
            <input
              type="text"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Ex: (11) 99999-9999"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {loading ? "A processar agendamento..." : "Confirmar Agendamento"}
        </button>
      </form>
    </div>
  );
}
