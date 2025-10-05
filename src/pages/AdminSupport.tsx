import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

const AdminSupport = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTickets();
  }, [filterStatus]);

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket.id);
      subscribeToMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadTickets = async () => {
    let query = supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data, error } = await query;

    if (!error && data) {
      setTickets(data);
    }
  };

  const loadMessages = async (ticketId: string) => {
    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  };

  const subscribeToMessages = (ticketId: string) => {
    const channel = supabase
      .channel(`admin-ticket-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selectedTicket.id,
      sender_id: user!.id,
      sender_type: "admin",
      message: newMessage.trim(),
    });

    if (error) {
      toast({
        title: "Erro ao enviar mensagem",
        variant: "destructive",
      });
    } else {
      // Atualizar status para in_progress se estiver open
      if (selectedTicket.status === "open") {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress" })
          .eq("id", selectedTicket.id);
        
        setSelectedTicket({ ...selectedTicket, status: "in_progress" });
        loadTickets();
      }
      setNewMessage("");
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket) return;

    const { error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", selectedTicket.id);

    if (error) {
      toast({
        title: "Erro ao atualizar status",
        variant: "destructive",
      });
    } else {
      setSelectedTicket({ ...selectedTicket, status });
      loadTickets();
      toast({
        title: "Status atualizado!",
      });
    }
  };

  const handleUpdatePriority = async (priority: string) => {
    if (!selectedTicket) return;

    const { error } = await supabase
      .from("support_tickets")
      .update({ priority })
      .eq("id", selectedTicket.id);

    if (error) {
      toast({
        title: "Erro ao atualizar prioridade",
        variant: "destructive",
      });
    } else {
      setSelectedTicket({ ...selectedTicket, priority });
      loadTickets();
      toast({
        title: "Prioridade atualizada!",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      open: <AlertCircle className="h-4 w-4 text-green-500" />,
      in_progress: <Clock className="h-4 w-4 text-yellow-500" />,
      closed: <CheckCircle2 className="h-4 w-4 text-gray-500" />,
    };
    return icons[status] || null;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: "Aberto",
      in_progress: "Em andamento",
      closed: "Fechado",
    };
    return labels[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: "text-blue-500",
      normal: "text-gray-500",
      high: "text-orange-500",
      urgent: "text-red-500",
    };
    return colors[priority] || "text-gray-500";
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Admin
          </Button>
          <h1 className="text-2xl font-bold">Painel de Suporte</h1>
          <p className="text-sm text-muted-foreground">Gerencie tickets de usuários</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Estatísticas */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-500">Abertos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.open}</p>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-yellow-500">Em Andamento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.in_progress}</p>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Fechados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.closed}</p>
            </CardContent>
          </Card>
        </div>

        {/* Layout Principal */}
        <div className="grid grid-cols-3 gap-6">
          {/* Lista de Tickets */}
          <Card className="shadow-medium col-span-1">
            <CardHeader>
              <CardTitle>Tickets</CardTitle>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abertos</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="closed">Fechados</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer transition-colors",
                    selectedTicket?.id === ticket.id
                      ? "bg-accent border-primary"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium text-sm flex-1">{ticket.subject}</p>
                    {getStatusIcon(ticket.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {getStatusLabel(ticket.status)}
                    </Badge>
                    <span className={cn("text-xs", getPriorityColor(ticket.priority))}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(ticket.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Chat */}
          <Card className="shadow-medium col-span-2">
            {selectedTicket ? (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedTicket.subject}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Criado em {new Date(selectedTicket.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={selectedTicket.priority}
                        onValueChange={handleUpdatePriority}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={selectedTicket.status}
                        onValueChange={handleUpdateStatus}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Aberto</SelectItem>
                          <SelectItem value="in_progress">Em Andamento</SelectItem>
                          <SelectItem value="closed">Fechado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col h-[500px]">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.sender_type === "admin" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] p-3 rounded-lg",
                            msg.sender_type === "admin"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm font-medium mb-1">
                            {msg.sender_type === "admin" ? "Você (Admin)" : "Usuário"}
                          </p>
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  {selectedTicket.status !== "closed" && (
                    <div className="flex gap-2 border-t pt-4">
                      <Input
                        placeholder="Digite sua resposta..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                      />
                      <Button onClick={handleSendMessage} size="icon">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-[600px]">
                <p className="text-muted-foreground">
                  Selecione um ticket para visualizar
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminSupport;
