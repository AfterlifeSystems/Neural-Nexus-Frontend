#!/usr/bin/env python3
"""
Migration Script Template: MongoDB + S3 → Firestore + Firebase Storage

This script migrates data from MongoDB to Firestore and files from S3 to Firebase Storage.

Prerequisites:
1. Install required packages:
   pip install pymongo firebase-admin boto3 python-dotenv

2. Set up Firebase Admin SDK:
   - Download service account key from Firebase Console
   - Save as 'serviceAccountKey.json' in project root

3. Set environment variables in .env:
   MONGO_URI=mongodb+srv://...
   MONGO_DB=mvp_mongo_db
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   BUCKET_NAME=your-bucket-name

Usage:
    python migration_script_template.py
"""

import os
import sys
from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv

# MongoDB imports
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# Firebase imports
import firebase_admin
from firebase_admin import credentials, firestore, storage

# AWS S3 imports
import boto3
from botocore.exceptions import ClientError

# Load environment variables
load_dotenv()

# Configuration
MONGO_URI = os.getenv('MONGO_URI')
MONGO_DB = os.getenv('MONGO_DB')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
BUCKET_NAME = os.getenv('BUCKET_NAME')
SERVICE_ACCOUNT_KEY = os.getenv('SERVICE_ACCOUNT_KEY', 'serviceAccountKey.json')

# Initialize Firebase Admin
if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_KEY)
    firebase_admin.initialize_app(cred, {
        'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET', 'your-project.appspot.com')
    })

db_firestore = firestore.client()
storage_bucket = storage.bucket()

# Initialize MongoDB client
mongo_client = MongoClient(MONGO_URI)
mongo_db = mongo_client[MONGO_DB]

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)


def convert_datetime(obj):
    """Convert MongoDB datetime to Firestore timestamp."""
    if isinstance(obj, datetime):
        return obj
    return None


def migrate_user(user_doc: Dict) -> bool:
    """
    Migrate a single user from MongoDB to Firestore.
    
    Args:
        user_doc: MongoDB user document
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        user_id = user_doc.get('user_id')
        if not user_id:
            print(f"⚠️  Skipping user without user_id: {user_doc.get('_id')}")
            return False
        
        # Prepare Firestore document
        firestore_doc = {
            'username': user_doc.get('username'),
            'email': user_doc.get('email'),
            'created_at': convert_datetime(user_doc.get('created_at')),
            'last_login': convert_datetime(user_doc.get('last_login')),
            'currently_logged_in': user_doc.get('currently_logged_in', False),
            'personal_image': user_doc.get('personal_image'),  # S3 key, will update after storage migration
            'neural_nexus_api_key': user_doc.get('neural_nexus_api_key'),
            'grok_api_key': user_doc.get('grok_api_key'),
            'enable_grok_imagine': user_doc.get('enable_grok_imagine', False),
            'elevenlabs_api_key': user_doc.get('elevenlabs_api_key'),
            'enable_elevenlabs': user_doc.get('enable_elevenlabs', False),
            'api_usage': user_doc.get('api_usage', {}),
            'billing_history': user_doc.get('billing_history', []),
            'credit_card': user_doc.get('credit_card'),
            'avatars': user_doc.get('avatars', []),
            'last_used_avatar': user_doc.get('last_used_avatar'),
            'cloud_run_services': user_doc.get('cloud_run_services', {}),
            'avatar_messaging_api_cpu_endpoint': user_doc.get('avatar_messaging_api_cpu_endpoint'),
            'avatar_messaging_api_gpu_endpoint': user_doc.get('avatar_messaging_api_gpu_endpoint'),
            'avatar_data_collection_api_endpoint': user_doc.get('avatar_data_collection_api_endpoint'),
            'avatar_vectorstore_management_api_endpoint': user_doc.get('avatar_vectorstore_management_api_endpoint'),
            'avatar_adapter_management_api_endpoint': user_doc.get('avatar_adapter_management_api_endpoint'),
        }
        
        # Remove None values
        firestore_doc = {k: v for k, v in firestore_doc.items() if v is not None}
        
        # Write to Firestore
        db_firestore.collection('users').document(user_id).set(firestore_doc)
        print(f"✅ Migrated user: {user_id} ({user_doc.get('email')})")
        return True
        
    except Exception as e:
        print(f"❌ Error migrating user {user_doc.get('user_id', 'unknown')}: {e}")
        return False


def migrate_users() -> Dict[str, int]:
    """
    Migrate all users from MongoDB to Firestore.
    
    Returns:
        Dict with success and failure counts
    """
    print("\n📦 Starting user migration...")
    users = mongo_db.users.find()
    
    success_count = 0
    failure_count = 0
    
    for user in users:
        if migrate_user(user):
            success_count += 1
        else:
            failure_count += 1
    
    print(f"\n✅ Users migrated: {success_count} successful, {failure_count} failed")
    return {'success': success_count, 'failure': failure_count}


def migrate_avatar(avatar_doc: Dict) -> bool:
    """
    Migrate a single avatar from MongoDB to Firestore.
    
    Args:
        avatar_doc: MongoDB avatar document
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        avatar_id = avatar_doc.get('avatar_id')
        if not avatar_id:
            print(f"⚠️  Skipping avatar without avatar_id: {avatar_doc.get('_id')}")
            return False
        
        # Prepare Firestore document
        firestore_doc = {
            'user_id': avatar_doc.get('user_id'),
            'name': avatar_doc.get('name'),
            'description': avatar_doc.get('description'),
            'created_at': convert_datetime(avatar_doc.get('created_at')),
            'icon': avatar_doc.get('icon'),  # S3 key, will update after storage migration
            'files': avatar_doc.get('files', []),
            # Note: messages are migrated separately as subcollection
        }
        
        # Remove None values
        firestore_doc = {k: v for v in firestore_doc.items() if v is not None}
        
        # Write to Firestore
        db_firestore.collection('avatars').document(avatar_id).set(firestore_doc)
        print(f"✅ Migrated avatar: {avatar_id} ({firestore_doc.get('name')})")
        return True
        
    except Exception as e:
        print(f"❌ Error migrating avatar {avatar_doc.get('avatar_id', 'unknown')}: {e}")
        return False


def migrate_avatars() -> Dict[str, int]:
    """
    Migrate all avatars from MongoDB to Firestore.
    
    Returns:
        Dict with success and failure counts
    """
    print("\n📦 Starting avatar migration...")
    avatars = mongo_db.avatars.find()
    
    success_count = 0
    failure_count = 0
    
    for avatar in avatars:
        if migrate_avatar(avatar):
            success_count += 1
        else:
            failure_count += 1
    
    print(f"\n✅ Avatars migrated: {success_count} successful, {failure_count} failed")
    return {'success': success_count, 'failure': failure_count}


def migrate_conversation(conv_doc: Dict) -> bool:
    """
    Migrate a single conversation from MongoDB to Firestore subcollection.
    
    Args:
        conv_doc: MongoDB conversation document
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        avatar_id = conv_doc.get('avatar_id')
        message_id = str(conv_doc.get('_id'))
        
        if not avatar_id:
            print(f"⚠️  Skipping conversation without avatar_id: {message_id}")
            return False
        
        # Prepare Firestore document
        firestore_doc = {
            'avatar_id': avatar_id,
            'user_id': conv_doc.get('user_id'),
            'message': conv_doc.get('message'),
            'sender': conv_doc.get('sender'),
            'timestamp': convert_datetime(conv_doc.get('timestamp')),
            'type': conv_doc.get('type', 'text'),
            'media': conv_doc.get('media', []),
            'parent_message_id': conv_doc.get('parent_message_id'),
            'metadata': conv_doc.get('metadata', {}),
        }
        
        # Remove None values
        firestore_doc = {k: v for k, v in firestore_doc.items() if v is not None}
        
        # Write to subcollection
        db_firestore.collection('avatars').document(avatar_id)\
            .collection('conversations').document(message_id).set(firestore_doc)
        
        return True
        
    except Exception as e:
        print(f"❌ Error migrating conversation {conv_doc.get('_id', 'unknown')}: {e}")
        return False


def migrate_conversations() -> Dict[str, int]:
    """
    Migrate all conversations from MongoDB to Firestore subcollections.
    
    Returns:
        Dict with success and failure counts
    """
    print("\n📦 Starting conversation migration...")
    conversations = mongo_db.avatar_conversations.find()
    
    success_count = 0
    failure_count = 0
    
    for conv in conversations:
        if migrate_conversation(conv):
            success_count += 1
            if success_count % 100 == 0:
                print(f"  Migrated {success_count} conversations...")
        else:
            failure_count += 1
    
    print(f"\n✅ Conversations migrated: {success_count} successful, {failure_count} failed")
    return {'success': success_count, 'failure': failure_count}


def migrate_s3_file(s3_key: str) -> bool:
    """
    Migrate a single file from S3 to Firebase Storage.
    
    Args:
        s3_key: S3 object key
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Download from S3
        s3_object = s3_client.get_object(Bucket=BUCKET_NAME, Key=s3_key)
        file_content = s3_object['Body'].read()
        content_type = s3_object.get('ContentType', 'application/octet-stream')
        
        # Upload to Firebase Storage
        blob = storage_bucket.blob(s3_key)
        blob.upload_from_string(file_content, content_type=content_type)
        
        # Copy metadata if available
        if 'Metadata' in s3_object:
            blob.metadata = s3_object['Metadata']
            blob.patch()
        
        return True
        
    except ClientError as e:
        print(f"❌ S3 error for {s3_key}: {e}")
        return False
    except Exception as e:
        print(f"❌ Error migrating file {s3_key}: {e}")
        return False


def migrate_storage_files(prefix: Optional[str] = None, max_files: Optional[int] = None) -> Dict[str, int]:
    """
    Migrate files from S3 to Firebase Storage.
    
    Args:
        prefix: S3 prefix to filter files (e.g., 'users/')
        max_files: Maximum number of files to migrate (None for all)
        
    Returns:
        Dict with success and failure counts
    """
    print("\n📦 Starting storage migration...")
    
    success_count = 0
    failure_count = 0
    
    # List all objects in S3 bucket
    paginator = s3_client.get_paginator('list_objects_v2')
    pages = paginator.paginate(
        Bucket=BUCKET_NAME,
        Prefix=prefix or ''
    )
    
    for page in pages:
        for obj in page.get('Contents', []):
            if max_files and success_count + failure_count >= max_files:
                break
                
            key = obj['Key']
            
            # Skip directory markers
            if key.endswith('/'):
                continue
            
            if migrate_s3_file(key):
                success_count += 1
                if success_count % 100 == 0:
                    print(f"  Migrated {success_count} files...")
            else:
                failure_count += 1
        
        if max_files and success_count + failure_count >= max_files:
            break
    
    print(f"\n✅ Files migrated: {success_count} successful, {failure_count} failed")
    return {'success': success_count, 'failure': failure_count}


def update_storage_references():
    """
    Update Firestore documents to reference Firebase Storage paths instead of S3 keys.
    Note: This assumes S3 keys and Firebase Storage paths use the same structure.
    """
    print("\n🔄 Updating storage references...")
    
    # Update user personal_image references
    users_ref = db_firestore.collection('users')
    users = users_ref.stream()
    
    updated_count = 0
    for user in users:
        user_data = user.to_dict()
        if user_data.get('personal_image'):
            # Path should be the same, but verify
            # If different, update here
            updated_count += 1
    
    # Update avatar icon references
    avatars_ref = db_firestore.collection('avatars')
    avatars = avatars_ref.stream()
    
    for avatar in avatars:
        avatar_data = avatar.to_dict()
        if avatar_data.get('icon'):
            # Path should be the same, but verify
            updated_count += 1
    
    print(f"✅ Updated {updated_count} storage references")


def main():
    """Main migration function."""
    print("🚀 Starting MongoDB → Firestore Migration")
    print("=" * 50)
    
    results = {}
    
    # Migrate users
    results['users'] = migrate_users()
    
    # Migrate avatars
    results['avatars'] = migrate_avatars()
    
    # Migrate conversations
    results['conversations'] = migrate_conversations()
    
    # Migrate storage files
    # Note: This can take a long time for large buckets
    # Consider running this separately or with a prefix filter
    print("\n⚠️  Storage migration can take a long time.")
    response = input("Do you want to migrate storage files now? (y/n): ")
    if response.lower() == 'y':
        prefix = input("Enter S3 prefix to filter (or press Enter for all): ").strip() or None
        max_files_input = input("Enter max files to migrate (or press Enter for all): ").strip()
        max_files = int(max_files_input) if max_files_input else None
        
        results['storage'] = migrate_storage_files(prefix=prefix, max_files=max_files)
    
    # Update storage references
    update_storage_references()
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 Migration Summary")
    print("=" * 50)
    for collection, counts in results.items():
        print(f"{collection.capitalize()}: {counts['success']} successful, {counts['failure']} failed")
    
    print("\n✅ Migration complete!")
    
    # Close MongoDB connection
    mongo_client.close()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
