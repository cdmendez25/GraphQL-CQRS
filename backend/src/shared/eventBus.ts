import { EventEmitter } from 'node:events';
import type { PersistedEvent } from '../write/events.js';

/**
 * Bus en memoria que avisa "hay eventos nuevos confirmados (COMMIT)".
 * Lo escuchan el proyector (actualiza el read model) y el process manager
 * (reacciona con nuevos comandos). La fuente de verdad sigue siendo la
 * tabla domain_events: si el proceso se reinicia, el proyector se pone al día.
 */
class DomainEventBus extends EventEmitter {
  publishCommitted(events: PersistedEvent[]) {
    if (events.length > 0) this.emit('committed', events);
  }

  onCommitted(listener: (events: PersistedEvent[]) => void) {
    this.on('committed', listener);
  }
}

export const eventBus = new DomainEventBus();
