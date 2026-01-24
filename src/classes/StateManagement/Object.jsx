/**
 * Firestore Key
 * collection drill-down
 * users/avatars/conversations|uploaded_documents|training_documents
 * users/avatars/conversations/messages
 * each collection has a document containing fields in the class below
 */

import { FieldValue } from 'firebase-admin/firestore';

/**
 * Used for: reference icons, reference audio, uploaded documents,
 * processed training documents in storage, and housing uploaded processed document metadata
 */
export class StorageFile {
  constructor({
    storage_file_id,
    url = null,
    storagePath = null,
    name,
    size,
    type,
    created_at = new Date(),
    updated_at = null,
    metadata = {}
  }) {
    this.storage_file_id = storage_file_id;
    this.url = url;
    this.storagePath = storagePath;
    this.name = name;
    this.size = size;
    this.type = type;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.metadata = metadata;
  }

  toDict() {
    return {
      storage_file_id: this.storage_file_id,
      url: this.url,
      storagePath: this.storagePath,
      name: this.name,
      size: this.size,
      type: this.type,
      created_at: this.created_at,
      updated_at: this.updated_at,
      metadata: this.metadata
    };
  }
}

// User object
export class User {
  constructor({
    user_id,
    display_name,
    email,
    created_at = new Date(),
    updated_at = null,
    last_login = null,
    currently_logged_in,
    last_used_avatar_id = null
  }) {
    this.user_id = user_id;
    this.display_name = display_name;
    this.email = email;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.last_login = last_login;
    this.currently_logged_in = currently_logged_in;
    this.last_used_avatar_id = last_used_avatar_id;
  }

  toDict() {
    return {
      user_id: this.user_id,
      display_name: this.display_name,
      email: this.email,
      created_at: this.created_at,
      updated_at: this.updated_at,
      last_login: this.last_login,
      currently_logged_in: this.currently_logged_in,
      last_used_avatar_id: this.last_used_avatar_id
    };
  }
}

// Avatar Object
export class Avatar {
  constructor({
    avatar_id,
    user_id,
    name,
    description = null,
    created_at = new Date(),
    updated_at = null,
    icon = null,
    reference_audio = null,
    current_conversation_id,
    adapter = null,
    metadatas = {}
  }) {
    this.avatar_id = avatar_id;
    this.user_id = user_id;
    this.name = name;
    this.description = description;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.icon = icon;
    this.reference_audio = reference_audio;
    this.current_conversation_id = current_conversation_id;
    this.adapter = adapter;
    this.metadatas = metadatas;
  }

  toDict() {
    return {
      avatar_id: this.avatar_id,
      user_id: this.user_id,
      name: this.name,
      description: this.description,
      created_at: this.created_at,
      updated_at: this.updated_at,
      icon: this.icon ? this.icon.toDict() : null,
      reference_audio: this.reference_audio ? this.reference_audio.toDict() : null,
      current_conversation_id: this.current_conversation_id,
      adapter: this.adapter ? this.adapter.toDict() : null,
      metadatas: this.metadatas
    };
  }
}

// Conversation Object
export class Conversation {
  constructor({
    conversation_id,
    created_at = new Date(),
    updated_at = null,
    summary = null,
    message_count = 0
  }) {
    this.conversation_id = conversation_id;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.summary = summary;
    this.message_count = message_count;
  }

  toDict() {
    return {
      conversation_id: this.conversation_id,
      created_at: this.created_at,
      updated_at: this.updated_at,
      summary: this.summary,
      message_count: this.message_count
    };
  }
}

// Message Object
export class Message {
  constructor({
    message_id,
    role,
    content,
    created_at = new Date(),
    updated_at = null,
    media = []
  }) {
    this.message_id = message_id;
    this.role = role; // "user" or "assistant"
    this.content = content; // Llama API content format
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.media = media;
  }

  toDict() {
    return {
      message_id: this.message_id,
      role: this.role,
      content: this.content,
      created_at: this.created_at,
      updated_at: this.updated_at,
      media: this.media.map(m => m.toDict ? m.toDict() : m)
    };
  }
}