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

  useEffect(() => {
    if (!selectedDate) {
      setBookedSlots([]);
      return;
    }
    const fetchBookedSlots = async () => {
      try {
        const res = await api.get(`/appointments?date=${selectedDate}&barber_id=${selectedBarber}`);
        const appointments = res.data || [];
        setBookedSlots(appointments.map((app) => app.time));
      } catch (err) {
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

      const existing = JSON.parse(localStorage.getItem("studio01_appointments") || "[]");
      localStorage.setItem("studio01_appointments", JSON.stringify([...existing, payload]));

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
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl max-w-3xl mx-auto border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 text-center tracking-tight">Agendamento Studio 01</h2>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">{error}</div>}
      {successMessage && <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium">{successMessage}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Escolha do Barbeiro */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">1. Escolha o Barbeiro</label>
          <div className="grid grid-cols-2 gap-4">
            {BARBERS.map((barber) => (
              <button
                type="button"
                key={barber.id}
                onClick={() => {
                  setSelectedBarber(barber.id);
                  setSelectedTime("");
                }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedBarber === barber.id
                    ? "border-black bg-black text-white shadow-md scale-[1.01]"
                    : "border-gray-200 hover:border-gray-400 bg-gray-50 text-gray-800"
                }`}
              >
                <div className="font-bold text-base">{barber.name}</div>
                <div className={`text-xs mt-1 ${selectedBarber === barber.id ? "text-gray-300" : "text-gray-500"}`}>
                  {barber.specialty}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Escolha do Serviço — Lista Estilizada para evitar esconder opções */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">2. Escolha o Serviço</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border border-gray-200 rounded-xl bg-gray-50">
            {SERVICES.map((service) => {
              const isSelected = selectedService === service.id;
              return (
                <button
                  type="button"
                  key={service.id}
                  onClick={() => setSelectedService(service.id)}
                  className={`p-3 rounded-lg border text-left flex justify-between items-center transition-all ${
                    isSelected
                      ? "border-black bg-black text-white font-semibold shadow-sm"
                      : "border-gray-200 bg-white hover:bg-gray-100 text-gray-800"
                  }`}
                >
                  <span className="text-sm">{service.name}</span>
                  <span className={`text-xs font-bold whitespace-nowrap ml-2 ${isSelected ? "text-gray-200" : "text-gray-600"}`}>
                    {service.prefix ? `${service.prefix} ` : ""}{BRL(service.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Data e Horários Disponíveis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">3. Data do Atendimento</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedTime("");
              }}
              className="w-full p-3.5 border border-gray-300 rounded-xl focus:outline-none focus:border-black bg-white text-gray-800 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">4. Horários (Intervalo de 40 min)</label>
            {!selectedDate ? (
              <div className="p-3.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-500 text-sm text-center">
                Selecione a data primeiro
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-xl bg-gray-50">
                {ALL_TIME_SLOTS.map((time) => {
                  const isBooked = bookedSlots.includes(time);
                  const isSelected = selectedTime === time;
                  return (
                    <button
                      type="button"
                      key={time}
                      disabled={isBooked}
                      onClick={() => setSelectedTime(time)}
                      className={`py-2 px-1 text-sm rounded-lg border text-center font-medium transition-all ${
                        isBooked
                          ? "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed line-through"
                          : isSelected
                          ? "bg-black text-white border-black shadow-sm"
                          : "bg-white border-gray-200 text-gray-800 hover:border-black"
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Dados do Cliente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Seu Nome</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full p-3.5 border border-gray-300 rounded-xl focus:outline-none focus:border-black text-gray-800"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Seu Telefone / WhatsApp</label>
            <input
              type="text"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Ex: (11) 99999-9999"
              className="w-full p-3.5 border border-gray-300 rounded-xl focus:outline-none focus:border-black text-gray-800"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-4 rounded-xl font-bold text-base hover:bg-gray-800 transition-colors shadow-lg disabled:opacity-50 mt-4"
        >
          {loading ? "A processar agendamento..." : "Confirmar Agendamento"}
        </button>
      </form>
    </div>
  );
}
