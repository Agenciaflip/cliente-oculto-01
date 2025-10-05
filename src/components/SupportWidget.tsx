import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, X, Send, Plus, Clock } from "lucide-react";
import { format } from "date-fns";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

interface Message {
  id: string;
  message: string;
  sender_type: string;
  created_at: string;
}

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "new" | "chat">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
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
      .channel("support-tickets-changes")
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
      .channel(`support-messages-${ticketId}`)
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
          if ((payload.new as Message).sender_type === "admin") {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createTicket = async () => {
    if (!newTicketSubject || !newTicketMessage) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: user.id,
        subject: newTicketSubject,
        status: "open",
        priority: "normal"
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro ao criar ticket",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    if (ticket) {
      await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_type: "user",
        message: newTicketMessage
      });

      setNewTicketSubject("");
      setNewTicketMessage("");
      setSelectedTicket(ticket.id);
      setView("chat");
      toast({
        title: "Ticket criado!",
        description: "Nossa equipe responderá em breve."
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage || !selectedTicket) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selectedTicket,
      sender_id: user.id,
      sender_type: "user",
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
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      open: "default",
      in_progress: "secondary",
      closed: "outline"
    };
    const labels: Record<string, string> = {
      open: "Aberto",
      in_progress: "Em Progresso",
      closed: "Fechado"
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setUnreadCount(0);
        }}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-110 z-50 flex items-center justify-center"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Widget de Chat */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 h-[500px] shadow-2xl z-50 flex flex-col">
          <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Suporte
              </CardTitle>
              {view !== "list" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setView("list");
                    setSelectedTicket(null);
                  }}
                  className="text-primary-foreground hover:bg-primary-foreground/20"
                >
                  Voltar
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
            {/* Lista de Tickets */}
            {view === "list" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <Button
                  onClick={() => setView("new")}
                  className="w-full bg-gradient-to-r from-primary to-primary/80"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ticket
                </Button>

                {tickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum ticket ainda</p>
                  </div>
                ) : (
                  tickets.map(ticket => (
                    <Card
                      key={ticket.id}
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => {
                        setSelectedTicket(ticket.id);
                        setView("chat");
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{ticket.subject}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(ticket.status)}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(ticket.created_at), "dd/MM/yyyy")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Novo Ticket */}
            {view === "new" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium">Assunto</label>
                  <Input
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                    placeholder="Descreva o problema brevemente"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Mensagem</label>
                  <Textarea
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    placeholder="Descreva o problema em detalhes"
                    rows={6}
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={createTicket}
                  className="w-full bg-gradient-to-r from-primary to-primary/80"
                  disabled={!newTicketSubject || !newTicketMessage}
                >
                  Criar Ticket
                </Button>
              </div>
            )}

            {/* Chat */}
            {view === "chat" && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.sender_type === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t bg-background">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Digite sua mensagem..."
                    />
                    <Button onClick={sendMessage} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
