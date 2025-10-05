import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Plus, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
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

const SupportWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "chat" | "new">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

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
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user?.id)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setTickets(data);
      const openTickets = data.filter((t) => t.status === "open").length;
      setUnreadCount(openTickets);
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
      .channel(`ticket-${ticketId}`)
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
          if ((payload.new as Message).sender_type === "admin") {
            toast({
              title: "Nova resposta do suporte!",
              description: "Você recebeu uma nova mensagem",
            });
          }
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
      sender_type: "user",
      message: newMessage.trim(),
    });

    if (error) {
      toast({
        title: "Erro ao enviar mensagem",
        variant: "destructive",
      });
    } else {
      setNewMessage("");
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      toast({
        title: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .insert({
        user_id: user!.id,
        subject: newTicketSubject.trim(),
        status: "open",
        priority: "normal",
      })
      .select()
      .single();

    if (ticketError) {
      toast({
        title: "Erro ao criar ticket",
        variant: "destructive",
      });
      return;
    }

    const { error: messageError } = await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user!.id,
      sender_type: "user",
      message: newTicketMessage.trim(),
    });

    if (messageError) {
      toast({
        title: "Erro ao enviar mensagem",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Ticket criado!",
      description: "Nossa equipe responderá em breve",
    });

    setNewTicketSubject("");
    setNewTicketMessage("");
    setView("list");
    loadTickets();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-green-500",
      in_progress: "bg-yellow-500",
      closed: "bg-gray-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: "Aberto",
      in_progress: "Em andamento",
      closed: "Fechado",
    };
    return labels[status] || status;
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary to-accent rounded-full shadow-strong flex items-center justify-center hover:scale-110 transition-transform z-50"
        >
          <MessageCircle className="h-6 w-6 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Widget Panel */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[600px] shadow-strong z-50 flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-accent p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              {view !== "list" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setView("list");
                    setSelectedTicket(null);
                  }}
                  className="text-white hover:bg-white/20"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <MessageCircle className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">
                {view === "list" ? "Suporte" : view === "new" ? "Novo Ticket" : selectedTicket?.subject}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* List View */}
            {view === "list" && (
              <div className="space-y-2">
                <Button
                  onClick={() => setView("new")}
                  className="w-full bg-gradient-to-r from-primary to-accent"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ticket
                </Button>

                {tickets.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum ticket ainda
                  </p>
                ) : (
                  tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setView("chat");
                      }}
                      className="p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-sm">{ticket.subject}</p>
                        <div className={cn("w-2 h-2 rounded-full", getStatusColor(ticket.status))} />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {getStatusLabel(ticket.status)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* New Ticket View */}
            {view === "new" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Assunto</label>
                  <Input
                    placeholder="Descreva o problema brevemente"
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Mensagem</label>
                  <textarea
                    className="w-full min-h-[200px] p-3 border rounded-lg resize-none"
                    placeholder="Descreva seu problema em detalhes..."
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleCreateTicket}
                  className="w-full bg-gradient-to-r from-primary to-accent"
                >
                  Criar Ticket
                </Button>
              </div>
            )}

            {/* Chat View */}
            {view === "chat" && (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.sender_type === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] p-3 rounded-lg",
                        msg.sender_type === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
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
            )}
          </div>

          {/* Chat Input */}
          {view === "chat" && selectedTicket?.status !== "closed" && (
            <div className="p-4 border-t flex gap-2">
              <Input
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <Button onClick={handleSendMessage} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      )}
    </>
  );
};

export default SupportWidget;
