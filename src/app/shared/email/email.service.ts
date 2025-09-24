import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class EmailService {
  enviarInvitacion(destino: string, hogar: string, codigo: string) {
    const params = { to_email: destino, hogar, codigo };
    return emailjs.send(
      environment.emailjs.serviceId,
      environment.emailjs.templateId,
      params,
      environment.emailjs.publicKey
    );
  }

  enviarAvisoHogarEliminado(destino: string, hogar: string, adminNombre: string) {
    const params = {
      to_email: destino,
      hogar,
      admin_nombre: adminNombre || 'Administrador',
    };
    return emailjs.send(
      environment.emailjs.serviceId,
      environment.emailjs.templates.hogarEliminado,
      params,
      environment.emailjs.publicKey
    );
  }
}
