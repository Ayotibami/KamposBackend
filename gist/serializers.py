from rest_framework import serializers
from .models import Gist, Comment, Media, Reaction, Report, View

class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Media
        fields = ['media_id', 'entity_type', 'entity_id', 'media_type', 
                 'media_file', 'uploaded_at', 'edited_at', 'thumbnail_url']

class ReactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reaction
        fields = ['reaction_id', 'avitag', 'entity_type', 'entity_id', 
                 'type', 'created_at']

class CommentSerializer(serializers.ModelSerializer):
    reactions = ReactionSerializer(many=True, read_only=True)

    class Meta:
        model = Comment
        fields = ['comment_id', 'gist', 'avitag', 'text', 
                 'commented_at', 'reactions']
        read_only_fields = ['comment_id', 'avitag', 'commented_at']

class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['report_id', 'reported_by', 'gist', 'reason', 'status',
                 'action_taken', 'reviewed_by', 'reviewed_at', 'created_at']
        read_only_fields = ['report_id', 'reported_by', 'status', 'action_taken',
                          'reviewed_by', 'reviewed_at', 'created_at']

class ViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = View
        fields = ['view_id', 'gist', 'avi_tag', 'viewed_at']
        read_only_fields = ['view_id', 'avi_tag', 'viewed_at']

class GistSerializer(serializers.ModelSerializer):
    media = MediaSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    reactions = ReactionSerializer(many=True, read_only=True)
    view_count = serializers.SerializerMethodField()

    class Meta:
        model = Gist
        fields = ['gist_id', 'gist_text', 'created_at', 'edited_at', 
                 'avitag', 'is_reported', 'media', 'comments', 'reactions', 'view_count']
        read_only_fields = ['gist_id', 'created_at', 'edited_at', 
                          'avitag', 'is_reported']

    def get_view_count(self, obj):
        return obj.views.count()