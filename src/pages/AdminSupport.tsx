import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Send, CheckCircle, Clock, User } from "lucide-react";
import { format } from "date-fns";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string;
  };
}

interface Message {
  id: string;
  message: string;
  sender_type: string;
  created_at: string;
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTickets();
    subscribeToTickets();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket);
      subscribeToMessages(selectedTicket);
    }
  }, [selectedTicket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadTickets = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select(`
        *,
        profiles:user_id (
          full_name
        )
      `)
      .order("created_at", { ascending: false });

    if (data) setTickets(data);
  };

  const loadMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (data) setMessages(data);
  };

  const subscribeToTickets = () => {
    const channel = supabase
      .channel("admin-support-tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets"
        },
        () => loadTickets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToMessages = (ticketId: string) => {
    const channel = supabase
      .channel(`admin-support-messages-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage || !selectedTicket) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selectedTicket,
      sender_id: user.id,
      sender_type: "admin",
      message: newMessage
    });

    if (error) {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    setNewMessage("");
    
    // Atualizar status do ticket para "em progresso" se estiver aberto
    const ticket = tickets.find(t => t.id === selectedTicket);
    if (ticket?.status === "open") {
      await supabase
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", selectedTicket);
    }
  };

  const closeTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "closed" })
      .eq("id", ticketId);

    if (error) {
      toast({
        title: "Erro ao fechar ticket",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Ticket fechado!",
      description: "O ticket foi marcado como resolvido."
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      open: "destructive",
      in_progress: "default",
      closed: "outline"
    };
    const labels: Record<string, string> = {
      open: "Aberto",
      in_progress: "Em Progresso",
      closed: "Fechado"
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filter === "all") return true;
    return ticket.status === filter;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    closed: tickets.filter(t => t.status === "closed").length
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">🎧 Suporte ao Cliente</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie tickets e responda aos clientes
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-destructive">{stats.open}</div>
              <div className="text-sm text-muted-foreground">Abertos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{stats.in_progress}</div>
              <div className="text-sm text-muted-foreground">Em Progresso</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">{stats.closed}</div>
              <div className="text-sm text-muted-foreground">Fechados</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Lista de Tickets */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Tickets</CardTitle>
              <Tabs value={filter} onValueChange={setFilter}>
                <TabsList className="grid grid-cols-4">
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="open">Abertos</TabsTrigger>
                  <TabsTrigger value="in_progress">Progresso</TabsTrigger>
                  <TabsTrigger value="closed">Fechados</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredTickets.map(ticket => (
                <Card
                  key={ticket.id}
                  className={`cursor-pointer transition-colors ${
                    selectedTicket === ticket.id ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                  onClick={() => setSelectedTicket(ticket.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{ticket.subject}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{ticket.profiles?.full_name || "Usuário"}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(ticket.status)}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(ticket.created_at), "dd/MM HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Conversa */}
          <Card className="col-span-2 flex flex-col">
            {selectedTicket ? (
              <>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Conversa</CardTitle>
                  <Button
                    onClick={() => closeTicket(selectedTicket)}
                    variant="outline"
                    size="sm"
                    disabled={tickets.find(t => t.id === selectedTicket)?.status === "closed"}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Fechar Ticket
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_type === "admin" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.sender_type === "admin"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {format(new Date(msg.created_at), "dd/MM HH:mm")}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Digite sua resposta..."
                    />
                    <Button onClick={sendMessage} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Selecione um ticket para visualizar</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
